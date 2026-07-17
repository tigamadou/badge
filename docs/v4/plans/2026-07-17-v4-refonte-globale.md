# Refonte globale v4 — Plan d'implementation unique

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Livrer la version v4 de Badge : HTTPS local, separation complete des espaces (staff/org/event), deconnexion propre, choix de role a la creation, stockage objet MinIO/S3 avec champs upload fonctionnels, et remplacement des quotas par un systeme d'abonnements catalogue + overrides avec facturation manuelle.

**Architecture:** Next.js 16 App Router + Prisma 6 + MySQL 8, multi-tenant Staff > Org > Event. La v4 introduit 3 espaces physiquement distincts (`/platform`, `/org/[orgId]`, `/org/[orgId]/event/[eventId]`) au lieu de vues imbriquees, un driver de stockage S3 derriere l'API existante de `src/lib/storage.ts`, et deux nouveaux modeles Prisma `Plan` + `Subscription` remplacant les champs `quota*` sur `Organization`.

**Tech Stack:** Next.js 16, React 19, Prisma 6, MySQL 8, NextAuth (Credentials/JWT), `@aws-sdk/client-s3`, MinIO (Docker), Caddy (`tls internal`), Vitest 4, Playwright.

## Global Constraints

- **Version cible : v4.** Toute la doc de ces changements vit dans `docs/v4/`. Le schema Prisma est partage entre versions et doit rester compatible avec v1 (prod) tant que v1 est deployee — voir Phase 6 pour la strategie de retrait des colonnes `quota*`.
- **Langue :** UI / emails / erreurs utilisateur en francais avec accents ; code / identifiants en anglais ; commentaires de code en francais ; noms de fichiers / branches / commits en ASCII.
- **Server Components par defaut ;** `"use client"` uniquement si interactivite requise.
- **Toute action sensible logge** via `logActivity({ type, ... })` (`src/lib/activity-log.ts`) ; tout nouveau type d'action => ajouter un `ActivityType` au schema Prisma.
- **Toute route API verifie le role/permission** via les helpers de `src/lib/auth-guards.ts` avant l'action.
- **Ne jamais exposer en reponse API :** hash bcrypt, `smtpPassword`, `recaptchaSecretKey`, tokens d'invitation/edition non hashes, cles de stockage brutes de documents d'identite.
- **Garde-fous metier :** bcrypt 12 rounds, mot de passe >= 6 caracteres ; uploads <= 5 Mo, types JPEG/PNG/WebP/PDF uniquement (`src/lib/storage.ts`) ; soft delete partout (`archived` + `archivedAt`).
- **Avant tout commit :** `make lint && make typecheck && make test`. Commits en francais ASCII, style conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur** (regle projet) — les etapes "Commit" de ce plan ne s'executent que si l'utilisateur l'a demande dans la session.
- **Actions a risque (demander avant) :** `make db-reset`, `--force-reset`, modification de `.env` / `docker-compose*.yml` / `Caddyfile*` / `Dockerfile*`, suppression dans `uploads/`.
- **Environnement :** les commandes `make` tournent dans le conteneur Docker de dev (`make dev` au prealable).

---

## Vue d'ensemble des phases

| Phase | Chantier (item Todo) | Nature | Risque |
|---|---|---|---|
| 1 | HTTPS local Caddy (item 1) | Infra | Faible |
| 2 | Separation des espaces + renommage (item 7) | Refactor structurel massif | Eleve |
| 3 | Deconnexion (item 4) | UI + auth | Faible |
| 4 | Roles a la creation (item 5) | UI + API | Moyen |
| 5 | Stockage MinIO/S3 + champs upload (item 6) | Infra + UI | Moyen |
| 6 | Abonnements remplacant les quotas (items 2+3) | Modele de donnees + enforcement + UI | Eleve |
| 7 | Doc v4 + nettoyage code mort | Doc | Faible |

Ordre justifie : la Phase 2 (renommage `/staff`->`/platform`, `/admin`->`/org`) est faite tot pour que toutes les phases suivantes s'ecrivent directement dans la structure finale et evitent un double deplacement de fichiers. Chaque phase se termine par un lint+typecheck+test verts.

---

# PHASE 1 — HTTPS local via Caddy `tls internal`

**But :** Acceder a `https://badge.local`, `https://pma.badge.local`, `https://mail.badge.local` en dev, avec l'app qui se sait servie en `https://badge.local` (NEXTAUTH/BASE_URL coherents).

**Fichiers du perimetre :**
- Modify: `Caddyfile.dev`
- Modify: `docker-compose.dev.yml` (mapping port 443 + volumes de persistance certs)
- Modify: `docker/compose.dev.env` (NEXTAUTH_URL)
- Modify: `README.md` (instructions confiance CA + /etc/hosts)
- Create: `docs/v4/installation.md` (section HTTPS local)

### Task 1.1 : Basculer Caddyfile.dev en HTTPS interne

**Files:**
- Modify: `Caddyfile.dev`

- [x] **Step 1 : Reecrire `Caddyfile.dev`** en retirant le prefixe `http://` (ce qui active l'auto-HTTPS) et en forcant la CA interne de Caddy :

```
badge.local {
	tls internal
	reverse_proxy app:3000
}

pma.badge.local {
	tls internal
	reverse_proxy phpmyadmin:80
}

mail.badge.local {
	tls internal
	reverse_proxy mailpit:8025
}
```

- [x] **Step 2 : Verifier la syntaxe** (le conteneur caddy valide au demarrage) : `docker compose -f docker-compose.dev.yml exec caddy caddy validate --config /etc/caddy/Caddyfile` — Attendu : `Valid configuration`. NOTE : le bind mount du conteneur en cours sert une copie tronquee (cache VirtioFS) ; validation confirmee via conteneur ephemere `docker run --rm -i caddy:2-alpine sh -c 'cat > /tmp/Caddyfile; caddy validate --config /tmp/Caddyfile --adapter caddyfile' < Caddyfile.dev` => `Valid configuration`.

### Task 1.2 : Exposer le port 443 et persister les certificats en dev

**Files:**
- Modify: `docker-compose.dev.yml:52-61` (service `caddy`)

> ATTENTION : modification d'un `docker-compose*.yml` — action a risque, demander confirmation avant d'appliquer.

- [ ] **Step 1 : Ajouter le port 443 et des volumes de persistance** au service `caddy` :

```yaml
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile.dev:/etc/caddy/Caddyfile
      - caddy_data_dev:/data
      - caddy_config_dev:/config
    depends_on:
      - app
      - phpmyadmin
      - mailpit
```

- [ ] **Step 2 : Declarer les volumes** en bas du fichier :

```yaml
volumes:
  mysql_data:
  caddy_data_dev:
  caddy_config_dev:
```

- [ ] **Step 3 : Redemarrer caddy** : `make dev-down && make dev`. Verifier `docker compose -f docker-compose.dev.yml ps` — caddy `Up`, 443 mappe.

### Task 1.3 : Aligner l'URL de base de l'app en dev

**Files:**
- Modify: `docker/compose.dev.env` (ligne `NEXTAUTH_URL`)

- [ ] **Step 1 : Passer `NEXTAUTH_URL` a l'URL https** dans `docker/compose.dev.env` :

```
NEXTAUTH_URL=https://badge.local
```

(La cascade `buildBaseUrl` de `src/lib/mail-helpers.ts:32` consommera cette valeur ; le fallback `http://localhost:3000` reste inchange pour les runs hors docker.)

- [ ] **Step 2 : Verifier** que les emails et badges pointent en https : demarrer l'app, declencher un email (ex. mot de passe oublie via `http`/`https://badge.local/forgot-password`) et verifier dans Mailpit (`https://mail.badge.local`) que les liens commencent par `https://badge.local`.

### Task 1.4 : Documenter la confiance de la CA Caddy

**Files:**
- Modify: `README.md` (section pre-requis dev)
- Create: `docs/v4/installation.md`

- [ ] **Step 1 : Ajouter au README** la procedure pour faire confiance a la racine CA de Caddy sur l'hote (sinon le navigateur affiche un avertissement). Extraire le root cert du conteneur :

```bash
docker compose -f docker-compose.dev.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
# macOS : ajouter au trousseau Systeme et marquer "Toujours approuver"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./caddy-root.crt
```

Rappeler que `/etc/hosts` doit contenir `127.0.0.1 badge.local pma.badge.local mail.badge.local`.

- [ ] **Step 2 : Creer `docs/v4/installation.md`** avec la section "HTTPS local" reprenant ces etapes + la liste des URLs `https://*.badge.local`.

- [ ] **Step 3 : Test navigateur** — ouvrir `https://badge.local`, confirmer le cadenas vert (apres confiance CA) et l'absence d'avertissement. Se connecter, verifier qu'aucune boucle de redirection NextAuth n'apparait.

- [ ] **Step 4 : Commit**

```bash
git add Caddyfile.dev docker-compose.dev.yml docker/compose.dev.env README.md docs/v4/installation.md
git commit -m "feat(v4): https local via caddy tls internal"
```

---

# PHASE 2 — Separation complete des espaces + renommage des routes

**But :** Trois espaces distincts, sans reutilisation des vues du niveau inferieur :
- `/platform/**` — staff applicatif (ex-`/staff`)
- `/org/[orgId]/**` — espace organisation (ex-`/admin/[orgId]`, hors events)
- `/org/[orgId]/event/[eventId]/**` — espace evenement (ex-`/admin/[orgId]/events/[eventId]`)

Et deux nouvelles surfaces de **consultation dediee** :
- Le staff consulte une org via des pages **propres** sous `/platform/organizations/[orgId]/**` (supervision, read-only), sans "descendre" dans `/org`.
- L'org consulte un event via l'espace event `/org/[orgId]/event/[eventId]/**` avec un shell adapte (deja amorce par les shells Operator/Printer/Viewer), sans reutiliser un espace "membre event" separe.

**Sous-decision actee :** on renomme egalement les namespaces API (`/api/staff`->`/api/platform`, `/api/admin`->`/api/org`) pour la coherence "renommage complet". C'est le gros du churn ; il se fait par un enchainement mecanique verifie (git mv + remplacement des call sites) suivi d'un lint+typecheck+test complet.

**Fichiers du perimetre (vue d'ensemble) :**
- Renomme (git mv) : tout `src/app/staff/**` -> `src/app/platform/**`, `src/app/admin/[orgId]/**` -> `src/app/org/[orgId]/**`, `src/app/admin/[orgId]/events/[eventId]/**` -> `src/app/org/[orgId]/event/[eventId]/**`, idem `src/app/api/staff/**` -> `src/app/api/platform/**` et `src/app/api/admin/**` -> `src/app/api/org/**`.
- Modify : tous les `Link href=`, `redirect(...)`, `fetch("/api/...")`, `router.push(...)` referencant ces prefixes (composants `src/components/**`, layouts, pages).
- Modify : shells `src/components/staff/StaffShell.tsx`, `src/components/admin/OrgShell.tsx`, `src/components/event/Event*Shell.tsx`, `SidebarNav.tsx`.
- Modify : `middleware.ts` s'il matche `/admin` ou `/staff` (verifier).
- Modify : tests unitaires et e2e referencant les anciens chemins (`src/**/__tests__`, `e2e/**`, `scripts/smoke-tests.ts`, `playwright.config.ts`).
- Create : pages de supervision staff dediees sous `src/app/platform/organizations/[orgId]/**`.

> Ce chantier est volumineux. Il est decoupe en : (A) renommage mecanique verifie, (B) suppression de la reutilisation staff->org (vues dediees), (C) shell/nav filtres par niveau.

## Bloc A — Renommage mecanique des routes

### Task 2.1 : Inventaire des references avant renommage

**Files:** aucun (lecture seule)

- [ ] **Step 1 : Lister toutes les references** aux prefixes a renommer, pour dimensionner et verifier ensuite :

```bash
rg -n "/api/staff|/api/admin|href=\"/staff|href=\"/admin|redirect\(\"/staff|redirect\(\"/admin|push\(\"/staff|push\(\"/admin|/admin/\$\{|/staff/" src e2e scripts | wc -l
rg -l "/api/staff|/api/admin|\"/staff|\"/admin" src e2e scripts
```

Attendu : une liste de fichiers a traiter (sauvegarder le nombre comme reference de verification post-renommage).

### Task 2.2 : Deplacer les dossiers de routes (git mv)

**Files:** renommage de dossiers uniquement.

- [ ] **Step 1 : Deplacer l'espace event hors de `events/[eventId]`** vers `event/[eventId]` a l'interieur de l'espace org, puis renommer l'espace org et staff. Ordre important (du plus profond au plus haut) :

```bash
cd /Users/amadou/Devs/projects/badge
# 1) event : events/[eventId] -> event/[eventId] (pages)
git mv src/app/admin/[orgId]/events/[eventId] src/app/admin/[orgId]/event/[eventId]
# la liste des events reste : src/app/admin/[orgId]/events/  (page.tsx + new/) -> a deplacer sous org
# 2) org pages : admin/[orgId] -> org/[orgId]
git mv src/app/admin src/app/org
# 3) staff pages : staff -> platform
git mv src/app/staff src/app/platform
# 4) API : admin -> org, staff -> platform (l'event API reste sous events/[eventId] cote API, cf. note)
git mv src/app/api/admin src/app/api/org
git mv src/app/api/staff src/app/api/platform
```

> Note API : on renomme les namespaces `/api/staff`->`/api/platform` et `/api/admin`->`/api/org` mais on **conserve** le segment `events/[eventId]` cote API (l'URL API n'est pas visible utilisateur ; seul l'espace de pages adopte `event/[eventId]`). Cela minimise le churn des `[eventId]` params. Documenter ce choix dans `docs/v4/architecture.md` (Phase 7).

- [ ] **Step 2 : Verifier** qu'aucun dossier `src/app/admin` ni `src/app/staff` ne subsiste : `test ! -d src/app/admin && test ! -d src/app/staff && echo OK`.

### Task 2.3 : Remplacer les references de chemins

**Files:** tous les fichiers listes en Task 2.1.

- [ ] **Step 1 : Remplacer les prefixes de pages** (URLs UI) dans `src` et tests. Faire les remplacements les plus specifiques d'abord pour eviter les collisions (`events/[eventId]` -> `event/[eventId]` a l'interieur des chemins de pages org uniquement) :

```bash
# URLs de pages : /admin/<orgId>/events/<id> -> /org/<orgId>/event/<id>
rg -l "/admin/" src e2e scripts | xargs sed -i '' -E 's#/admin/([^"/]*)/events/#/org/\1/event/#g'
# reste des pages org : /admin/ -> /org/
rg -l "/admin/" src e2e scripts | xargs sed -i '' 's#/admin/#/org/#g'
# pages staff : /staff -> /platform
rg -l "\"/staff" src e2e scripts | xargs sed -i '' 's#"/staff#"/platform#g'
```

> `sed -i ''` est la forme macOS (BSD). Verifier chaque famille de remplacement par un `git diff` avant de continuer.

- [ ] **Step 2 : Remplacer les prefixes API** (call sites `fetch`/`route`) :

```bash
rg -l "/api/admin|/api/staff" src e2e scripts | xargs sed -i '' -e 's#/api/admin#/api/org#g' -e 's#/api/staff#/api/platform#g'
```

- [ ] **Step 3 : Relire manuellement les cas non couverts par sed** — templates de chaine avec variables (`/admin/${orgId}/...`), navigation dans les shells (`SidebarNav`, `StaffShell`, `OrgShell`), `middleware.ts` (si present), et toute redirection dans les layouts. Chercher les restes :

```bash
rg -n "/admin|/staff|/api/admin|/api/staff" src middleware.ts 2>/dev/null
```

Attendu : 0 occurrence hors commentaires/docs. Corriger a la main sinon.

### Task 2.4 : Verifier le renommage de bout en bout

- [ ] **Step 1 : Typecheck** : `make typecheck` — Attendu : 0 erreur (les imports relatifs suivent les dossiers ; seules les erreurs viennent d'URLs restantes ou de params renommes).
- [ ] **Step 2 : Lint** : `make lint` — Attendu : pass.
- [ ] **Step 3 : Tests** : `make test` — comparer au baseline (memoire projet : suite E2E ~53 echecs pre-existants ; se concentrer sur les regressions unitaires/integration).
- [ ] **Step 4 : Test navigateur** — parcourir `https://badge.local` : login staff -> `/platform`, entrer dans une org -> `/org/[orgId]`, ouvrir un event -> `/org/[orgId]/event/[eventId]`. Verifier qu'aucun lien ne 404.
- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor(v4): renomme espaces staff->platform et admin->org, event sous org"
```

## Bloc B — Vues de supervision staff dediees (fin des vues imbriquees)

**But :** Le staff ne "descend" plus dans `/org/[orgId]` (espace des membres org). Il dispose d'un espace de supervision **read-only** sous `/platform/organizations/[orgId]/**` avec ses propres pages. Le bypass `if (ctx.isStaff) return true` de `hasOrgRole`/`effectiveEventRole` (`src/lib/auth-helpers.ts:73,90`) n'est plus utilise pour rendre l'espace org au staff.

**Fichiers du perimetre :**
- Existe deja : `src/app/platform/organizations/[orgId]/page.tsx` (fiche org read-only).
- Create : sous `src/app/platform/organizations/[orgId]/` les pages de supervision : `events/page.tsx` (liste des events de l'org, read-only), `members/page.tsx` (liste des membres org, read-only), `activity/page.tsx` (journal d'activite de l'org), `subscription/page.tsx` (Phase 6).
- Create : `src/components/platform/PlatformOrgShell.tsx` (shell de supervision : nav propre, bandeau "Supervision").
- Modify : `src/app/org/[orgId]/layout.tsx` — retirer l'autorisation d'acces staff sans membership (voir Step).
- Modify : `src/lib/auth-helpers.ts` — introduire un flag explicite plutot que le bypass implicite (voir Step).

### Task 2.5 : Rendre l'acces staff a `/org` explicite et non-imbrique

**Files:**
- Modify: `src/app/org/[orgId]/layout.tsx` (ex-`admin/[orgId]/layout.tsx:32,48`)
- Modify: `src/lib/auth-helpers.ts:72-77`
- Test: `src/lib/__tests__/auth-helpers.test.ts` (ou creer si absent)

**Interfaces:**
- Produces: `hasOrgRole(ctx, orgId, role, { allowStaff?: boolean })` — le parametre `allowStaff` par defaut `false`. Les routes API metier passent `{ allowStaff: true }` pour conserver le pouvoir d'action staff ; le **layout de pages `/org`** appelle sans `allowStaff` => le staff sans membership org est redirige vers son espace `/platform`.

- [ ] **Step 1 : Ecrire le test** du nouveau comportement dans `src/lib/__tests__/auth-helpers.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { hasOrgRole } from "@/lib/auth-helpers";

const staffCtx = { isStaff: true, staffRole: "SUPER_ADMIN", orgMemberships: [], eventMemberships: [] } as any;
const memberCtx = { isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }], eventMemberships: [] } as any;

describe("hasOrgRole allowStaff", () => {
  it("staff sans membership n'a PAS le role org par defaut", () => {
    expect(hasOrgRole(staffCtx, "o1", "AUDITOR")).toBe(false);
  });
  it("staff obtient le role si allowStaff=true", () => {
    expect(hasOrgRole(staffCtx, "o1", "AUDITOR", { allowStaff: true })).toBe(true);
  });
  it("membre org garde son role sans changement", () => {
    expect(hasOrgRole(memberCtx, "o1", "MANAGER")).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test, verifier l'echec** : `make test -- auth-helpers` (ou `docker compose ... exec app yarn vitest run auth-helpers`). Attendu : FAIL (signature actuelle sans options, bypass staff toujours true).

- [ ] **Step 3 : Modifier `hasOrgRole`** dans `src/lib/auth-helpers.ts` :

```ts
export function hasOrgRole(
  ctx: UserContext,
  orgId: string,
  role: OrgRole,
  opts: { allowStaff?: boolean } = {},
): boolean {
  if (opts.allowStaff && ctx.isStaff) return true;
  return ctx.orgMemberships.some(
    (m) => m.orgId === orgId && orgRoleAtLeast(m.role, role),
  );
}
```

- [ ] **Step 4 : Propager `allowStaff: true` dans les guards API** — dans `src/lib/auth-guards.ts:42-50` (`requireOrgRole`), ajouter le pouvoir staff explicite :

```ts
export async function requireOrgRole(userId: string, orgId: string, role: OrgRole): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  if (!hasOrgRole(ctx, orgId, role, { allowStaff: true })) throw new AuthError("ORG_FORBIDDEN", 403);
}
```

- [ ] **Step 5 : Modifier le layout `/org/[orgId]`** pour rediriger le staff sans membership vers son espace supervision. Remplacer le controle actuel (`!hasOrgRole(...) && !ctx.isStaff -> redirect`) par :

```ts
// Le staff ne consulte plus l'espace org : il a /platform/organizations/[orgId].
const isMember = hasOrgRole(ctx, orgId, "AUDITOR"); // sans allowStaff
if (!isMember) {
  if (ctx.isStaff) redirect(`/platform/organizations/${orgId}`);
  redirect("/platform"); // ou "/select" selon le point d'entree existant
}
```

Supprimer le flag `isStaffMode` et la `StaffBanner` de cet espace (l'espace org n'est plus rendu au staff).

- [ ] **Step 6 : Lancer les tests** : `make test -- auth-helpers` — Attendu : PASS. Puis `make typecheck`.

### Task 2.6 : Construire le shell de supervision staff

**Files:**
- Create: `src/components/platform/PlatformOrgShell.tsx`
- Create: `src/app/platform/organizations/[orgId]/layout.tsx`

- [ ] **Step 1 : Creer `PlatformOrgShell.tsx`** — un shell reprenant la charte de `StaffShell`/`SidebarNav` avec une nav propre a la supervision (Fiche, Evenements, Membres, Abonnement, Activite) et un bandeau "Supervision — lecture seule". S'inspirer de `src/components/staff/StaffShell.tsx` (structure) et `src/components/admin/OrgShell.tsx` (items) sans reutiliser les actions d'ecriture.

Items de nav (chemins relatifs a `/platform/organizations/${orgId}`) : `` (fiche), `/events`, `/members`, `/subscription`, `/activity`.

- [ ] **Step 2 : Creer le layout** `src/app/platform/organizations/[orgId]/layout.tsx` qui garde `requireStaff(userId, "STAFF_OBSERVER")` et enveloppe les enfants dans `PlatformOrgShell`.

- [ ] **Step 3 : Typecheck** : `make typecheck`.

### Task 2.7 : Pages de supervision staff (read-only)

**Files:**
- Create: `src/app/platform/organizations/[orgId]/events/page.tsx`
- Create: `src/app/platform/organizations/[orgId]/members/page.tsx`
- Create: `src/app/platform/organizations/[orgId]/activity/page.tsx`

- [ ] **Step 1 : `events/page.tsx`** — Server Component : `requireStaff`, charge `prisma.event.findMany({ where: { orgId }, ... })`, affiche un tableau read-only (titre, date, statut inscription, nb inscriptions comptables via `countCountableRegistrations`), chaque ligne liant vers... rien d'editable (pas de "Entrer dans l'org"). Si le staff doit agir sur un event, il le fait via l'API avec pouvoir staff, pas via l'espace org.

- [ ] **Step 2 : `members/page.tsx`** — tableau read-only des `OrgMembership` (nom, email, role, date) via `prisma.orgMembership.findMany`.

- [ ] **Step 3 : `activity/page.tsx`** — reutiliser les composants de `src/components/activity/*` filtres sur `orgId`, en lecture seule.

- [ ] **Step 4 : Mettre a jour la fiche org staff existante** (`src/app/platform/organizations/[orgId]/page.tsx`) : remplacer le bouton "Entrer dans l'organisation" (ancien lien vers `/admin/[orgId]`) par des liens vers ces nouvelles sous-pages de supervision.

- [ ] **Step 5 : Test navigateur** — en staff, `/platform/organizations/[orgId]` -> naviguer Events/Membres/Activite sans jamais atterrir sous `/org/[orgId]`. Verifier qu'acceder manuellement a `/org/[orgId]` en staff sans membership redirige vers la supervision.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(v4): espace supervision staff dedie, fin des vues org imbriquees"
```

## Bloc C — Nav et actions filtrees par niveau dans l'espace org/event

**But :** Dans `/org/[orgId]` et `/org/[orgId]/event/[eventId]`, la nav et les actions n'affichent que ce qui correspond au role effectif du membre (OWNER/MANAGER/AUDITOR cote org ; ADMIN/OPERATOR/PRINTER/VIEWER cote event). Les shells event par role existent deja ; il reste a filtrer la nav org.

### Task 2.8 : Filtrer la nav de l'OrgShell par role org

**Files:**
- Modify: `src/components/admin/OrgShell.tsx` (nav items statiques lignes ~24-31)
- Modify: `src/app/org/[orgId]/layout.tsx` (passer le role effectif au shell)

- [ ] **Step 1 : Calculer le role org effectif** dans le layout et le passer a `OrgShell` en prop `orgRole: OrgRole`.

- [ ] **Step 2 : Conditionner les items de nav** dans `OrgShell` : AUDITOR ne voit pas les entrees d'ecriture (Parametres, Membres en mode edition, creation d'event) ; MANAGER voit les events + templates mais pas les infos administratives/abonnement ; OWNER voit tout. Exprimer via une table `{ item, minRole }` filtree avec `orgRoleAtLeast`.

- [ ] **Step 3 : Test navigateur** — se connecter comme AUDITOR, MANAGER, OWNER (comptes de seed) et verifier la nav.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(v4): nav org filtree par role effectif"
```

---

# PHASE 3 — Deconnexion avec modal de confirmation

**But :** Remplacer les liens `<Link href="/api/auth/signout">` par un bouton qui ouvre une modal de confirmation ; a la confirmation, `signOut({ callbackUrl: "/" })` et redirection vers l'accueil public.

**Fichiers du perimetre :**
- Create: `src/components/auth/LogoutButton.tsx` (client)
- Modify: `src/components/staff/StaffShell.tsx:43-50`
- Modify: `src/app/account/layout.tsx:47-49`
- Modify: tout autre shell affichant une deconnexion (verifier `OrgShell`, `Event*Shell`, `PlatformOrgShell`)

### Task 3.1 : Composant LogoutButton reutilisable

**Files:**
- Create: `src/components/auth/LogoutButton.tsx`

**Interfaces:**
- Produces: `export function LogoutButton({ className?, label? }: { className?: string; label?: string })` — client component. Ouvre une modal (reutiliser le composant Modal du design system, cf. `src/components/ui`), boutons "Annuler" / "Se deconnecter". Confirmation => `signOut({ callbackUrl: "/" })` de `next-auth/react`.

- [ ] **Step 1 : Verifier le composant Modal existant** : `rg -n "export .*Modal|function .*Modal" src/components/ui` pour reutiliser la primitive du design system plutot qu'en creer une.

- [ ] **Step 2 : Ecrire `LogoutButton.tsx`** :

```tsx
"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
// importer le Modal du design system (adapter le chemin/API a l'existant)
import { Modal } from "@/components/ui/Modal";

export function LogoutButton({ className, label = "Deconnexion" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <LogOut size={18} aria-hidden /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Se deconnecter">
        <p>Voulez-vous vraiment vous deconnecter ?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={pending}>Annuler</button>
          <button
            type="button"
            onClick={() => { setPending(true); signOut({ callbackUrl: "/" }); }}
            disabled={pending}
          >
            {pending ? "Deconnexion..." : "Se deconnecter"}
          </button>
        </div>
      </Modal>
    </>
  );
}
```

> Adapter la signature `Modal` (`open`/`onClose`/`title`) a l'API reelle du design system releve au Step 1.

- [ ] **Step 3 : Typecheck** : `make typecheck`.

### Task 3.2 : Brancher LogoutButton dans tous les shells

**Files:**
- Modify: `src/components/staff/StaffShell.tsx`, `src/app/account/layout.tsx`, et tout shell avec deconnexion.

- [ ] **Step 1 : Remplacer** dans `StaffShell.tsx:43-50` le `<Link href="/api/auth/signout">` par `<LogoutButton className="..." />` (reprendre les classes existantes).

- [ ] **Step 2 : Remplacer** dans `src/app/account/layout.tsx:47-49` le lien "Se deconnecter" par `<LogoutButton label="Se deconnecter" className="text-slate-500 hover:text-green-600" />`.

- [ ] **Step 3 : Verifier les autres shells** (`OrgShell`, `Event*Shell`, `PlatformOrgShell`) : y ajouter `LogoutButton` s'ils exposent une deconnexion ; sinon confirmer qu'ils n'en ont pas.

- [ ] **Step 4 : Test navigateur** — cliquer "Deconnexion" dans chaque espace : la modal s'ouvre, "Annuler" la ferme sans effet, "Se deconnecter" deconnecte et redirige vers `/` (accueil public). Verifier qu'on n'atterrit plus sur la page NextAuth `/api/auth/signout`.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(v4): deconnexion via modal de confirmation et redirection accueil"
```

---

# PHASE 4 — Choix du role a la creation d'utilisateurs

**But :** Harmoniser le choix de role sur tous les flux de creation/invitation. Le manque principal : l'invitation de membre d'org impose OWNER (`OrgMemberForm.tsx` n'envoie que email+name ; API `default("OWNER")`). Objectif : exposer OWNER/MANAGER/AUDITOR, generaliser l'endpoint owners, supprimer le code mort v1.

**Fichiers du perimetre :**
- Modify: `src/components/admin/OrgMemberForm.tsx` (ajouter select role)
- Modify: `src/app/api/org/[orgId]/members/route.ts` (ex-`admin/[orgId]/members/route.ts:56`) — role requis, garde-fous
- Modify: `src/app/api/platform/organizations/[orgId]/owners/route.ts` (generaliser le role) + composant UI pour le brancher
- Delete: `src/components/admin/UserForm.tsx` (code mort, roles v1 OPERATOR/MODERATEUR/ADMIN)
- Test: `src/lib/__tests__/api-org.test.ts` (ou fichier de test existant des members)

### Task 4.1 : Select de role dans l'invitation de membre d'org

**Files:**
- Modify: `src/components/admin/OrgMemberForm.tsx`
- Modify: `src/app/api/org/[orgId]/members/route.ts`

**Interfaces:**
- Le formulaire envoie desormais `{ email, name, role }` avec `role: "OWNER" | "MANAGER" | "AUDITOR"`.
- La route valide `role: z.enum(["OWNER","MANAGER","AUDITOR"])` (requis, plus de `.default("OWNER")` implicite).

- [ ] **Step 1 : Ecrire le test API** dans le fichier de tests des members d'org : un POST avec `role: "MANAGER"` cree un `OrgMembership` MANAGER ; un POST sans `role` renvoie 400 (validation). Un OWNER peut inviter MANAGER/AUDITOR ; verifier `assertNotLastOwner` non impacte.

- [ ] **Step 2 : Lancer, verifier l'echec** : `make test -- api-org` — Attendu : FAIL (role encore force a OWNER).

- [ ] **Step 3 : Modifier la route** `src/app/api/org/[orgId]/members/route.ts` — remplacer `role: z.enum([...]).default("OWNER")` par un champ requis `role: z.enum(["OWNER", "MANAGER", "AUDITOR"])`, appliquer ce role a `orgMembership.create`. Conserver la verification `requireOrgRole(userId, orgId, "OWNER")` (seul un OWNER invite des membres).

- [ ] **Step 4 : Modifier le formulaire** `OrgMemberForm.tsx` — ajouter un `<select>` (design system) avec options OWNER/MANAGER/AUDITOR (defaut MANAGER), inclure `role` dans le body du `fetch`. Retirer le texte en dur "role OWNER".

- [ ] **Step 5 : Lancer les tests** : `make test -- api-org` — Attendu : PASS.

- [ ] **Step 6 : Test navigateur** — inviter un membre en MANAGER puis en AUDITOR, verifier le role affiche dans la liste.

### Task 4.2 : Generaliser l'endpoint owners (staff) avec choix de role + UI

**Files:**
- Modify: `src/app/api/platform/organizations/[orgId]/owners/route.ts`
- Create/Modify: composant d'invitation dans la supervision staff (`src/app/platform/organizations/[orgId]/members/page.tsx` + un form client)

- [ ] **Step 1 : Renommer semantiquement / generaliser** — l'endpoint accepte `{ email, name, role }` (`OWNER|MANAGER|AUDITOR`, defaut OWNER pour retrocompat). Appliquer le role au membership cree/upgrade. Conserver `requireStaff`.

- [ ] **Step 2 : Brancher un formulaire** dans la page de supervision membres staff pour inviter un membre org avec role choisi (aujourd'hui l'endpoint n'a aucune UI).

- [ ] **Step 3 : Test navigateur** — en staff, ajouter un membre org avec role MANAGER via la supervision.

### Task 4.3 : Supprimer le code mort v1

**Files:**
- Delete: `src/components/admin/UserForm.tsx`

- [ ] **Step 1 : Confirmer 0 usage** : `rg -n "UserForm" src` — Attendu : uniquement des auto-references dans le fichier lui-meme.
- [ ] **Step 2 : Supprimer** `git rm src/components/admin/UserForm.tsx`.
- [ ] **Step 3 : Typecheck + lint** : `make typecheck && make lint`.
- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(v4): choix du role a l'invitation de membre org et owners, suppression code mort"
```

---

# PHASE 5 — Stockage MinIO/S3 + champs upload fonctionnels

**But :** Basculer `src/lib/storage.ts` d'un stockage filesystem vers un driver S3 (`@aws-sdk/client-s3`) pointant sur MinIO (dev + prod), en conservant la signature publique de `storage.ts`. Corriger tous les champs "chemin texte" en vrais inputs fichier, unifier les contrats d'upload, et securiser `/api/files`. Suit la spec existante `docs/v3/specs/2026-05-31-v3-01-stockage-s3-et-backups.md`.

**Fichiers du perimetre :**
- Modify: `src/lib/storage.ts` (implementation S3, meme API + `deletePrefix`)
- Modify: `package.json` (dependance `@aws-sdk/client-s3`)
- Modify: `docker-compose.dev.yml` + `docker-compose.yml` (service `minio`)
- Modify: `.env` / `docker/compose.dev.env` (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`)
- Create: `.env.example` (documenter S3_*/UPLOAD_TOKEN_SECRET/MINIO_*)
- Modify: routes upload `src/app/api/upload/route.ts`, `src/app/api/account/upload/route.ts` (contrat unifie)
- Modify: `src/app/api/files/[...path]/route.ts` (controle d'acces)
- Modify: champs texte -> upload : `src/components/event/EventSettingsForm.tsx` (logo event), `src/app/org/[orgId]/settings/SettingsClient.tsx` (logo org), `src/components/event/RegistrationForm.tsx` (photo/document inscription admin)
- Modify: `src/lib/badge-templates/build-context.ts:59-91` (lecture fichier -> dataURL via `getFile` S3)
- Delete/retirer du dead code : `src/components/public/FileUploadField.tsx` et `src/components/admin/RegistrationForm.tsx` si non reutilises apres refonte.

> Les cles multi-tenant ideales sont `orgs/{orgId}/events/{eventId}/...` (spec v3-01). Les generateurs actuels (`eventPhotoKey`, `accountProfileKey`) restent valides ; on peut les enrichir en Phase ulterieure. Ne pas bloquer ce chantier sur la reorganisation des prefixes.

### Task 5.1 : Ajouter le service MinIO (dev + prod)

**Files:**
- Modify: `docker-compose.dev.yml`, `docker-compose.yml`, `.env`/`docker/compose.dev.env`, `.env.production.example`

> ATTENTION : modification `docker-compose*.yml` et `.env*` — actions a risque, demander confirmation.

- [ ] **Step 1 : Ajouter le service `minio`** a `docker-compose.dev.yml` (ports 9000/9001 exposes en dev) :

```yaml
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data_dev:/data
```

Declarer `minio_data_dev:` dans `volumes:`. Ajouter `minio` aux `depends_on` de `app`.

- [ ] **Step 2 : Idem en prod** (`docker-compose.yml`) sans exposer les ports sur Internet (reseau interne uniquement), volume `minio_data`.

- [ ] **Step 3 : Definir les variables** dans `docker/compose.dev.env` :

```
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=badge-dev
```

- [ ] **Step 4 : Creer le bucket** au demarrage (job `mc` ou creation applicative lazy). Choix simple : creation lazy dans `storage.ts` (Task 5.2, `ensureBucket`). Demarrer : `make dev-down && make dev`, verifier la console MinIO `http://localhost:9001`.

### Task 5.2 : Reecrire le driver storage en S3

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `package.json` (ajout `@aws-sdk/client-s3`)
- Test: `src/lib/__tests__/storage.test.ts`

**Interfaces:**
- Preserve: `uploadFile(key, body, contentType) => Promise<string>`, `getFile(key) => Promise<{ body: Buffer; contentType: string }>`, `deleteFile(key) => Promise<void>`, plus les generateurs de cle et validations (`MAX_UPLOAD_BYTES`, `isAllowedMime`, `assertWithinSizeLimit`, `eventPhotoKey`, `eventIdDocumentKey`, `accountProfileKey`).
- Produces (nouveau): `deletePrefix(prefix: string) => Promise<number>` (pour archivage org — utilise en Phase 6/7).

- [ ] **Step 1 : Ajouter la dependance** : `docker compose -f docker-compose.dev.yml exec app yarn add @aws-sdk/client-s3`.

- [ ] **Step 2 : Ecrire un test d'integration** `src/lib/__tests__/storage.test.ts` (skippe si `S3_ENDPOINT` absent) : upload d'un buffer, `getFile` renvoie le meme buffer + contentType, `deleteFile` supprime, `getFile` sur cle absente rejette.

- [ ] **Step 3 : Reimplementer `storage.ts`** avec le SDK S3, en conservant les constantes/validations/generateurs de cle du fichier actuel (lignes 6-56 inchangees) et en remplacant l'I/O :

```ts
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand, CreateBucketCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "badge-dev";
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true, // requis pour MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

let bucketReady: Promise<void> | null = null;
async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try { await s3.send(new HeadBucketCommand({ Bucket: BUCKET })); }
      catch { await s3.send(new CreateBucketCommand({ Bucket: BUCKET })); }
    })();
  }
  return bucketReady;
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await ensureBucket();
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = Buffer.from(await res.Body!.transformToByteArray());
  return { body, contentType: res.ContentType ?? "application/octet-stream" };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deletePrefix(prefix: string): Promise<number> {
  await ensureBucket();
  let deleted = 0, token: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    const objects = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objects.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } }));
      deleted += objects.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
```

> `getFile` persiste desormais le vrai `contentType` (corrige le `_contentType` ignore de l'ancien driver). `uploadFile` doit donc recevoir un contentType correct depuis les routes.

- [ ] **Step 4 : Lancer le test** : `make test -- storage` — Attendu : PASS (MinIO up).
- [ ] **Step 5 : Typecheck** : `make typecheck`.

### Task 5.3 : Unifier les contrats d'upload et securiser /api/files

**Files:**
- Modify: `src/app/api/upload/route.ts`, `src/app/api/account/upload/route.ts`
- Modify: `src/app/api/files/[...path]/route.ts`

- [ ] **Step 1 : Unifier le retour** — choisir un contrat unique. `/api/account/upload` renvoie deja `{ storageKey }` ; aligner `/api/upload` pour renvoyer `{ storageKey }` (au lieu du token HMAC) OU generaliser le token aux deux. Decision : **renvoyer `{ storageKey }` partout** et supprimer le flux token mort (`upload-token.ts`) s'il n'est plus utilise (verifier `rg -n verifyUploadToken src`). Passer le vrai `file.type` a `uploadFile`.

- [ ] **Step 2 : Securiser `/api/files/[...path]`** — ajouter un controle d'acces sur les documents sensibles (prefixes contenant `idDocuments`/`documents`) : n'autoriser que le proprietaire (`profile/{userId}/...` == session.id) ou un membre habilite de l'event/org (via `hasEventPermission(..., "event.read.detailed")`). Les images publiques (logos, photos de badge) restent servies. Retirer le `Cache-Control: public` sur les documents sensibles.

```ts
// pseudo-structure
const key = params.path.join("/");
if (isSensitiveKey(key)) {
  const session = await getServerSession(authOptions);
  if (!session || !(await canReadFile(session.user.id, key))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
const { body, contentType } = await getFile(key);
```

- [ ] **Step 3 : Test** — ecrire un test d'integration : un document `profile/{userId}/documents/x.pdf` renvoie 403 pour un autre user, 200 pour le proprietaire.

- [ ] **Step 4 : Lancer** : `make test -- files` — Attendu : PASS.

### Task 5.4 : Remplacer les champs texte par de vrais uploads

**Files:**
- Modify: `src/app/org/[orgId]/settings/SettingsClient.tsx` (logo org)
- Modify: `src/components/event/EventSettingsForm.tsx` (logo event)
- Modify: `src/components/event/RegistrationForm.tsx` (photo/document inscription admin)
- Reutiliser: `src/components/ui/FileBox.tsx` (`Dropzone`) et le pattern de `src/app/account/profile/ProfileForm.tsx` (upload -> storageKey -> champ cache).

- [ ] **Step 1 : Logo org** — dans `SettingsClient.tsx`, remplacer l'`Input` texte "Logo (URL)" par un `Dropzone` qui POST `/api/upload` (ou une route logo dediee `kind=logo` acceptant les images), recupere `storageKey`, l'affiche via `FileBox`, et l'envoie dans le PATCH settings (champ `logo`).

- [ ] **Step 2 : Logo event** — meme traitement dans `EventSettingsForm.tsx` (champ `logo`).

- [ ] **Step 3 : Inscription admin** — dans `src/components/event/RegistrationForm.tsx` (le formulaire reellement utilise), remplacer les `Input` "Chemin photo"/"Chemin document" par des `Dropzone` uploadant vers une route event (`/api/upload?context=event:{slug}&kind=photo|document`), stockant les `storageKey` retournes.

- [ ] **Step 4 : Aligner les MIME cote client** sur la whitelist serveur (JPEG/PNG/WebP pour photo ; +PDF pour document) — corriger tout `accept="image/*"` trop permissif.

- [ ] **Step 5 : build-context.ts** — verifier que `src/lib/badge-templates/build-context.ts:59-91` lit bien les images via `getFile(key)` (S3) et non via le filesystem local. Adapter si necessaire pour produire les dataURL a partir du Buffer S3.

- [ ] **Step 6 : Retirer le dead code** — apres bascule, `git rm src/components/public/FileUploadField.tsx` et `src/components/admin/RegistrationForm.tsx` si `rg` confirme 0 usage.

- [ ] **Step 7 : Test navigateur** — uploader un logo org, un logo event, une photo + un PDF sur une inscription admin ; verifier l'affichage, la persistance (reload), la generation de badge (photo visible), et l'acces refuse aux documents d'un autre user.

- [ ] **Step 8 : Creer `.env.example`** documentant `S3_*`, `MINIO_*`, `UPLOAD_TOKEN_SECRET`, `NEXTAUTH_URL`.

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat(v4): stockage minio s3, champs upload fonctionnels, acces fichiers securise"
```

---

# PHASE 6 — Abonnements (remplacent les quotas)

**But :** Retirer les champs `quotaMaxEvents`/`quotaMaxRegistrations`/`quotaMaxStorageMB` de `Organization` et introduire un catalogue de plans (`Plan`) + un abonnement par org (`Subscription`) avec overrides et facturation manuelle (statut + dates, **sans montant**). Limites appliquees : **nombre d'events par org** et **nombre de participants PAR EVENEMENT**. Enforcement : bloquer les creations au-dela de la limite ou si l'abonnement n'est pas actif ; l'existant reste consultable ; le staff garde un bypass audite.

**Fichiers du perimetre :**
- Modify: `prisma/schema.prisma` (models `Plan`, `Subscription`, enum `SubscriptionStatus`, `ActivityType` etendu ; retrait des 3 champs `quota*`)
- Create: `src/lib/subscription.ts` (`resolveOrgLimits`, `assertCanCreateEvent`, `assertCanRegister`)
- Modify: `src/app/api/org/[orgId]/events/route.ts` (ex `admin/[orgId]/events/route.ts:85-93`) — enforcement events
- Modify: `src/app/api/events/[slug]/register/route.ts:124-134` — enforcement participants PAR EVENT
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (inscription admin — bypass audite conserve)
- Delete: `src/lib/event-quota.ts` (`assertQuotaAvailable` code mort) ou le reimplementer proprement dans `subscription.ts`
- Create: pages plateforme de gestion des plans + assignation d'abonnement (`src/app/platform/plans/**`, `src/app/platform/organizations/[orgId]/subscription/**`)
- Create: page org read-only de son abonnement (`src/app/org/[orgId]/settings` ou une entree dediee)
- Modify: composants d'affichage quota existants (`src/components/ui/QuotaBar.tsx`, dashboards) pour lire les limites resolues
- Delete: usages residuels de `quotaMax*`
- Test: `src/lib/__tests__/subscription.test.ts`

### Task 6.1 : Modele de donnees Plan + Subscription

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces (schema cible) :**

```prisma
model Plan {
  id                      String   @id @default(cuid())
  name                    String   @unique
  maxEvents               Int?     // null = illimite
  maxParticipantsPerEvent Int?     // null = illimite
  archived                Boolean  @default(false)
  createdAt               DateTime @default(now())
  subscriptions           Subscription[]
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

model Subscription {
  id        String             @id @default(cuid())
  orgId     String             @unique          // un abonnement courant par org
  org       Organization       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  planId    String
  plan      Plan               @relation(fields: [planId], references: [id])
  status    SubscriptionStatus @default(ACTIVE)
  startDate DateTime           @default(now())
  endDate   DateTime?                            // null = sans echeance
  // Overrides par org (null = herite du plan)
  overrideMaxEvents               Int?
  overrideMaxParticipantsPerEvent Int?
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
}
```

- [ ] **Step 1 : Ajouter** `Plan`, `SubscriptionStatus`, `Subscription` au schema. Ajouter la relation inverse `subscription Subscription?` sur `Organization`.

- [ ] **Step 2 : Retirer** de `Organization` les champs `quotaMaxEvents`, `quotaMaxRegistrations`, `quotaMaxStorageMB` (lignes 102-104).

- [ ] **Step 3 : Etendre `ActivityType`** avec les nouveaux types : `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `PLAN_CREATED`, `PLAN_UPDATED`, `QUOTA_BYPASS` (si non deja present). Verifier l'enum `ActivityType` existant avant d'ajouter.

- [ ] **Step 4 : Appliquer le schema** — en dev : `make db-push` (recree/ajuste sans migration formelle). **Le retrait des colonnes `quota*` est destructif** : demander confirmation avant. En prod v1, ces colonnes n'existent que depuis v2 ; documenter la migration dans `docs/v4/architecture.md`.

- [ ] **Step 5 : Seed des plans par defaut** — ajouter au seed (`prisma/seed*` — reperer le fichier de seed) au moins deux plans : `Gratuit` (maxEvents: 1, maxParticipantsPerEvent: 100) et `Standard` (maxEvents: 10, maxParticipantsPerEvent: 1000). `make db-seed`.

### Task 6.2 : Helper de resolution des limites

**Files:**
- Create: `src/lib/subscription.ts`
- Test: `src/lib/__tests__/subscription.test.ts`

**Interfaces:**
- Produces:
  - `resolveOrgLimits(orgId: string): Promise<{ maxEvents: number | null; maxParticipantsPerEvent: number | null; active: boolean }>` — lit la `Subscription` + `Plan`, applique les overrides (override != null gagne, sinon plan), calcule `active = status === "ACTIVE" && (endDate == null || endDate > now)`.
  - `class SubscriptionError extends Error` avec `code: "NO_SUBSCRIPTION" | "SUBSCRIPTION_INACTIVE" | "EVENT_LIMIT" | "PARTICIPANT_LIMIT"` et `httpStatus`.
  - `assertCanCreateEvent(orgId: string): Promise<void>` — throw si `!active` ou si `event.count({ orgId, archived: false }) >= maxEvents`.
  - `assertCanRegister(eventId: string): Promise<void>` — resout l'org de l'event, throw si `!active` ou si `countCountableRegistrations(eventId) >= maxParticipantsPerEvent` (comptage PAR EVENT).

- [ ] **Step 1 : Ecrire les tests** dans `src/lib/__tests__/subscription.test.ts` couvrant : resolution herite du plan ; override gagne ; abonnement expire => `active=false` ; limite events atteinte => `EVENT_LIMIT` ; limite participants par event atteinte => `PARTICIPANT_LIMIT` ; limites `null` => jamais bloquant.

- [ ] **Step 2 : Lancer, verifier l'echec** : `make test -- subscription` — Attendu : FAIL (module absent).

- [ ] **Step 3 : Implementer `src/lib/subscription.ts`**. Reutiliser `countCountableRegistrations` de `src/lib/event-quota.ts` (comptage PENDING+APPROVED par event) — le deplacer dans `subscription.ts` si on supprime `event-quota.ts`. `assertCanRegister` compte desormais **par event** (`where: { eventId }`), corrigeant l'incoherence org-scope actuelle.

- [ ] **Step 4 : Lancer** : `make test -- subscription` — Attendu : PASS.

### Task 6.3 : Brancher l'enforcement

**Files:**
- Modify: `src/app/api/org/[orgId]/events/route.ts`
- Modify: `src/app/api/events/[slug]/register/route.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts`

- [ ] **Step 1 : Creation d'event** — remplacer le bloc quota actuel (`org?.quotaMaxEvents != null ...`) par `try { await assertCanCreateEvent(orgId) } catch (e) { if (e instanceof SubscriptionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus }) }`. Conserver le bypass staff : si l'appelant est staff, journaliser `logActivity({ type: "QUOTA_BYPASS", staffActor: true, ... })` et ne pas bloquer.

- [ ] **Step 2 : Inscription publique** — remplacer le bloc quota (`register/route.ts:124-134`) par `assertCanRegister(event.id)` (429 sur `PARTICIPANT_LIMIT`, 403/409 sur inactif). Le message utilisateur reste "Inscriptions completes." pour `PARTICIPANT_LIMIT`.

- [ ] **Step 3 : Inscription admin** — conserver le comportement de bypass audite : calculer si on depasse la limite resolue et logger `quotaBypass` dans `logActivity` (adapter le calcul a `resolveOrgLimits`).

- [ ] **Step 4 : Supprimer** `src/lib/event-quota.ts` si tout son contenu utile a migre vers `subscription.ts` (`rg -n "event-quota" src` doit etre vide apres). Mettre a jour les imports des dashboards.

- [ ] **Step 5 : Tests** : `make test` (integration events + register) — Attendu : les tests de quota migres passent avec la nouvelle semantique par event.

### Task 6.4 : UI plateforme — catalogue de plans + assignation d'abonnement

**Files:**
- Create: `src/app/platform/plans/page.tsx` (liste), `src/app/platform/plans/new/page.tsx`, formulaire
- Create: `src/app/api/platform/plans/route.ts` + `[planId]/route.ts` (CRUD, `requireStaff("STAFF_ADMIN")`)
- Create: `src/app/platform/organizations/[orgId]/subscription/page.tsx` + form d'assignation
- Create: `src/app/api/platform/organizations/[orgId]/subscription/route.ts` (upsert Subscription, `requireStaff`)

- [ ] **Step 1 : CRUD plans** — routes API staff pour creer/editer/archiver un `Plan` (nom, maxEvents, maxParticipantsPerEvent nullable). Logger `PLAN_CREATED`/`PLAN_UPDATED`.

- [ ] **Step 2 : Assignation d'abonnement** — route API staff pour upsert la `Subscription` d'une org (planId, status, startDate, endDate, overrides). Logger `SUBSCRIPTION_CREATED`/`SUBSCRIPTION_UPDATED`. Ne jamais exposer d'info sensible.

- [ ] **Step 3 : Pages** — dans `/platform/plans` : liste + formulaire de plan. Dans `/platform/organizations/[orgId]/subscription` : selecteur de plan, statut (ACTIVE/EXPIRED/CANCELLED), dates, overrides.

- [ ] **Step 4 : Test navigateur** — creer un plan, l'assigner a une org avec `endDate` passee -> verifier que la creation d'event/inscription est bloquee cote org ; remettre `ACTIVE` avec dates valides -> debloque.

### Task 6.5 : UI org read-only de l'abonnement + affichage des limites

**Files:**
- Create/Modify: entree "Abonnement" dans l'espace org (`src/app/org/[orgId]/subscription/page.tsx`, read-only OWNER)
- Modify: `src/components/ui/QuotaBar.tsx` et dashboards (`src/app/org/[orgId]/page.tsx`, `src/app/org/[orgId]/event/[eventId]/page.tsx`) pour lire `resolveOrgLimits` au lieu de `org.quotaMax*`

- [ ] **Step 1 : Page org abonnement** — read-only : plan courant, statut, dates, limites effectives (events, participants/event). Visible OWNER (et MANAGER en lecture selon nav Phase 2).

- [ ] **Step 2 : Dashboards** — remplacer toute lecture de `org.quotaMaxEvents`/`quotaMaxRegistrations` par les valeurs de `resolveOrgLimits`. Le dashboard event affiche la limite **par event** (participants) ; le dashboard org affiche la limite d'events.

- [ ] **Step 3 : Retirer les residus** — `rg -n "quotaMax" src` doit etre vide. Supprimer les champs des formulaires staff de creation/edition d'org (`OrgCreationForm.tsx`, edition org) qui editaient les quotas.

- [ ] **Step 4 : Test navigateur** — verifier les barres de progression et l'alerte >80% sur la nouvelle source.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(v4): abonnements plan+subscription remplacant les quotas, enforcement par event"
```

---

# PHASE 7 — Documentation v4 + nettoyage final

**But :** Refleter l'etat final dans `docs/v4/` et supprimer les residus.

**Fichiers du perimetre :**
- Create: `docs/v4/README.md`, `docs/v4/architecture.md`
- Create: `docs/v4/features/abonnements.md`, `docs/v4/features/espaces-separes.md`, `docs/v4/features/stockage-s3.md`
- Modify: `docs/README.md` (ajouter v4 au tableau des versions)
- Modify: `CLAUDE.md` (mettre a jour la version active si v4 devient courante)

### Task 7.1 : Documentation d'architecture v4

- [ ] **Step 1 : `docs/v4/README.md`** — index, vue d'ensemble des 7 chantiers, etat d'avancement (lier ce plan).
- [ ] **Step 2 : `docs/v4/architecture.md`** — nouvelle arbo des espaces (`/platform`, `/org/[orgId]`, `/org/[orgId]/event/[eventId]`), note sur le namespace API (`/api/platform`, `/api/org`, event garde `events/[eventId]`), RBAC inchange, garde-fous. Documenter la strategie de migration du retrait des colonnes `quota*` vis-a-vis de v1 prod.
- [ ] **Step 3 : Features** — `abonnements.md` (modele, resolution, enforcement, facturation manuelle), `espaces-separes.md` (supervision staff, fin des vues imbriquees), `stockage-s3.md` (driver MinIO, cles, securisation /api/files) — lier a la spec v3-01.

### Task 7.2 : Mise a jour de l'index et nettoyage

- [ ] **Step 1 : `docs/README.md`** — ajouter la ligne v4 (statut "En construction"), decaler v2/v3 si besoin.
- [ ] **Step 2 : Nettoyage** — verifier qu'aucun dead code identifie ne subsiste : `rg -n "UserForm|FileUploadField|event-quota|quotaMax|/api/admin|/api/staff|/admin/|href=\"/staff" src` — Attendu : 0.
- [ ] **Step 3 : Verification finale** : `make lint && make typecheck && make test`. Test navigateur du golden path complet en `https://badge.local`.
- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "docs(v4): documentation refonte globale et nettoyage final"
```

---

## Self-review (couverture spec)

| Item Todo | Phase | Couvert |
|---|---|---|
| 1. Caddy HTTPS local | Phase 1 | Oui |
| 2. Retirer quotas d'events | Phase 6 (retrait des 3 champs + code mort) | Oui |
| 3. Systeme d'abonnements | Phase 6 (Plan+Subscription, catalogue+overrides, facturation manuelle, par event) | Oui |
| 4. Corriger deconnexion | Phase 3 (modal + signOut callbackUrl "/") | Oui |
| 5. Roles a la creation | Phase 4 (select partout, generalisation owners, dead code) | Oui |
| 6. Champs fichiers + S3 | Phase 5 (MinIO driver, champs upload, /api/files securise) | Oui |
| 7. Vues par niveau, dé-imbriquer | Phase 2 (renommage + supervision staff dediee + nav filtree) | Oui |

## Points a confirmer par l'implementeur en cours de route (defauts assumes)

- **Migration prod des colonnes `quota*`** : ce plan cible le dev (`make db-push`). Une vraie migration Prisma versionnee sera necessaire avant tout deploiement prod (documentee Phase 7 Task 7.1 Step 2).
- **Namespace API** : renomme `/api/staff`->`/api/platform`, `/api/admin`->`/api/org` mais conserve `events/[eventId]` cote API. Si l'implementeur prefere conserver les namespaces API actuels pour reduire le churn, seul le renommage des pages est strictement requis par la decision "renommage complet" (qui portait sur les URLs de pages).
- **Storage keys multi-tenant** : les generateurs de cle actuels sont conserves ; la reorganisation en `orgs/{orgId}/events/{eventId}/...` (spec v3-01) peut etre faite dans un second temps sans bloquer.
- **maxStorageMB** : non repris comme dimension d'abonnement (les deux limites demandees sont events et participants/event). A rajouter plus tard si besoin, maintenant que MinIO permet de mesurer l'usage.
