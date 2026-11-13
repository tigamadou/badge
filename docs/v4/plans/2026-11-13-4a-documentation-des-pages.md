# Lot 4a — Documentation contextuelle des pages (outil, panneau, pages, consignes IA, pilote /org) — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans la stack de l'agent :
> `scripts/agent-stack.sh up 4a feat/roles-imprimeur-support` (worktree `../badge-wt-4a`, branche
> `feat/roles-imprimeur-support-4a`), **partie de la branche d'intégration après la vague 3**
> (rôles fusionnés, compatibilité retirée : pages et permissions définitives). **Toutes les
> commandes `make` tournent dans le worktree** (`make -C ../badge-wt-4a …`). En exécution
> automatisée, un commit par tâche est autorisé sur `feat/roles-imprimeur-support-4a` ; sinon aucun
> commit sans demande. Sous-agents éventuels sur Sonnet. Aucun push, aucun déploiement.

**Objectif :** livrer l'outil hors ligne `scripts/page-docs` (`make docs-check`, `make docs-stamp`),
le format des docs, le bouton « ? » et son panneau, les pages Documentation des quatre espaces, les
consignes pour les agents IA, et rédiger la doc de l'espace pilote `/org` pour valider le format.

**Architecture :** un fichier Markdown par page dans `src/content/page-docs/<espace>/…` ; un outil
TypeScript sans API externe qui découvre les pages, calcule les sources et leur empreinte, vérifie
le format et réécrit deux modules générés embarqués au build ; une logique serveur testée à 100 %
dans `src/lib/page-docs/**` (appariement route → doc, filtrage des blocs par permission, rendu
Markdown) ; un composant client `PageDocButton` qui ouvre un panneau alimenté par
`GET /api/page-docs` ; des pages `…/docs` et `…/docs/[...slug]` dans les quatre espaces.

**Tech Stack :** TypeScript 5, `tsx` (déjà présent), Vitest 4 (base `_test`), Playwright,
`markdown-it` (rendu Markdown, `html: false`), Next.js 16 App Router, Tailwind 4.

**Spec :** [`specs/2026-11-13-40-v4-documentation-des-pages.md`](../specs/2026-11-13-40-v4-documentation-des-pages.md)
(catalogue des permissions : [`spec 37`](../specs/2026-11-13-37-v4-roles-et-permissions.md) ;
coordination : [`spec 36`](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md), vague 4).

**Plans amont :** `2026-11-13-3-fusion-roles.md` (vague 3, terminée). **Plan aval :**
`2026-11-13-5-docs-fusion-et-pr.md` (vague 5 : rédaction des docs des autres espaces).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Pré-contrôles et inventaire des pages | [x] | 2026-11-13 | pages hors docs : plateforme 41, organisation 18, évènement 25, compte 5 (89) |
| 2 | Outil : découverte, chemins de doc, sources, empreinte | [ ] | | |
| 3 | Outil : format (frontmatter, blocs), vérification, manifestes | [ ] | | |
| 4 | Cibles `docs-check` / `docs-stamp` et intégration à `lint` | [ ] | | |
| 5 | Logique serveur : appariement, cibles, blocs, rendu | [ ] | | |
| 6 | Route `GET /api/page-docs` | [ ] | | |
| 7 | `PageDocButton` réel et panneau latéral | [ ] | | |
| 8 | Pages Documentation des quatre espaces | [ ] | | |
| 9 | Consignes IA : `CLAUDE.md`, `AGENTS.md`, template, skill chantier | [ ] | | |
| 10 | Doc de feature `documentation-pages.md` | [ ] | | |
| 11 | Pilote : docs des pages `/org` | [ ] | | |
| 12 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Fichiers de la spec 36 (vague 4) :

- `scripts/page-docs/**` (outil) et ses tests `scripts/__tests__/page-docs/**` ;
- `src/content/page-docs/**` (docs et modules générés) ;
- `src/components/page-docs/**` ;
- `src/app/platform/docs/**`, `src/app/org/[orgId]/docs/**`, `src/app/event/[eventId]/docs/**`,
  `src/app/account/docs/**` ;
- `Makefile` (cibles `docs-check`, `docs-stamp`, `lint`, `.PHONY`), `package.json`, `yarn.lock` ;
- `CLAUDE.md` (section « Documentation des pages »), `AGENTS.md` (symlink vers `CLAUDE.md`, voir
  Task 9), `.claude/CLAUDE.md`, `.claude/skills/chantier/**` ;
- `docs/v4/features/documentation-pages.md`.

**Ajouts nécessaires (nouveaux fichiers, aucun conflit possible, à signaler à l'orchestrateur et
à journaliser dans la spec 40)** — la spec place le filtrage par permission et le rendu côté serveur
sans désigner de fichier, et la règle « 100 % sur `src/lib/**` et `src/app/api/**` » impose que cette
logique y vive :

- `src/lib/page-docs/**` (nouveau) et `src/lib/page-docs/__tests__/**` ;
- `src/app/api/page-docs/route.ts` (nouveau) et son test dans `src/app/api/page-docs/__tests__/` ;
- `e2e/transverse/page-docs.spec.ts` (nouveau).

**En lecture seule (besoin d'y toucher → s'arrêter et le signaler)** : tous les fichiers du socle et
des lots de rôles, dont `src/lib/permissions/**` (le catalogue et `loadPermissions` sont consommés
tels quels), `StaffShell`, `OrgShell`, `EventShell`, `src/app/account/layout.tsx` (le bouton y est
déjà inséré par le socle, avec le menu « Documentation »), `prisma/schema.prisma`, `.env*`,
`docker-compose*.yml`, `Dockerfile*`, `Caddyfile`, `.cursor/rules/project.mdc`, `src/test/factories.ts`
(si une fabrique manque : signaler, ne pas dupliquer de `prisma.*.create`).

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), valables pour tous les tests de ce lot :

- **Base de test dédiée** : Vitest tourne sur `badge_4a_test` (variable `TEST_DATABASE_URL` de la
  stack) ; `make test` la crée et la met au schéma ; garde-fou de `src/test-setup.ts`.
- **Pas de mock de la base ni de Prisma** : les tests de `src/lib/page-docs/**` et de la route
  utilisent le vrai MySQL ; seule la session NextAuth se mocke. L'outil `scripts/page-docs` n'utilise
  ni base ni réseau : ses tests travaillent sur un dossier temporaire du scratchpad.
- **Fabriques** : `src/test/factories.ts` (utilisateurs staff par clé de rôle système, memberships,
  évènements), graine fixée par fichier ; pas de `prisma.*.create` dupliqués.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander.
- **Couverture** : 100 % sur `src/lib/**` (dont `src/lib/page-docs/**`) et `src/app/api/**`
  (dont `src/app/api/page-docs/route.ts`) ; la gate de `vitest.config.ts` ne doit pas être touchée.
- **e2e** (Playwright) : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.

Contraintes du lot (spec 40) :

- **Aucun appel à l'API Anthropic, aucune commande de régénération, aucun hook** : l'outil ne rédige
  rien ; il vérifie, tamponne et génère les modules.
- Docs en **français avec accents, vouvoiement**, ton du guide utilisateur existant ; n'expliquer que
  ce que l'écran montre, libellés de l'interface, **jamais de secret ni de donnée personnelle**.
- Rendu Markdown **sans HTML brut** (`html: false`), liens `javascript:` refusés.
- Doc **embarquée au build** (compatible `output: "standalone"`) : aucune lecture disque à
  l'exécution.
- Pas de déploiement ; **ne pas modifier `.env*`** ; `Makefile` : seules les cibles du lot (aucun
  changement des cibles de déploiement ni d'initialisation).
- Pages publiques (`/e/…`, marketing, inscription) hors périmètre.

## Review Focus

Entrées et conditions que la spec implique sans que les tâches ne les exercent déjà, les plus
probables d'abord :

- Page de route dynamique **dont le nom de doc entre en collision** avec une autre après omission
  des segments dynamiques (`/platform/users` et `/platform/users/[userId]`) : l'outil applique la
  règle de désambiguïsation de la Task 2 et `docs-check` signale toute collision restante.
- **Bloc `:::permission` non fermé, imbriqué, ou avec une clé inconnue** : `docs-check` échoue avec
  fichier et ligne ; le panneau ne casse jamais le rendu (bloc mal formé ignoré, texte conservé).
- **Utilisateur sans permission** sur la page : le panneau masque les blocs correspondants ; il ne
  fuit pas leur contenu dans la réponse de l'API (filtrage côté serveur, pas CSS).
- **Page sans doc** : aucun bouton « ? » (et pas d'erreur console) ; **route inconnue ou chemin
  hors espaces connectés** : l'API répond 404, sans message révélant la structure interne.
- **Un compte archivé, bloqué ou non connecté** : 401/403 de l'API, pas de doc servie.
- **Source supprimée ou renommée** après le tampon : la doc est signalée obsolète, pas plantage de
  l'outil (import non résolu ignoré, fichier absent compté dans l'empreinte comme absent).
- **Docs mises à jour sans changement de sens** : `docs-stamp` seul suffit, le diff ne touche que
  `sources`, `sourceHash`, `updatedAt` et les modules générés.
- **Panneau** : focus piégé et rendu au bouton à la fermeture, `Escape` ferme, plein écran à 375 px,
  pas de défilement horizontal à 375, 1024 et 1280 px (menu latéral ~224 px dès `lg`).
- **Sortie du manifeste non déterministe** (ordre, fin de ligne) : deux exécutions consécutives
  ne produisent aucun diff.

---

### Task 1: Pré-contrôles et inventaire des pages

- [ ] Se placer dans le worktree et vérifier la base :
  ```bash
  scripts/agent-stack.sh up 4a feat/roles-imprimeur-support
  git -C ../badge-wt-4a rev-parse --abbrev-ref HEAD && git -C ../badge-wt-4a log --oneline -3
  grep -rnE "minRole|StaffRole\b" ../badge-wt-4a/src --include=*.ts --include=*.tsx | head -3
  ```
  Expected: branche `feat/roles-imprimeur-support-4a` issue de la vague 3 ; **aucune ligne** au
  `grep` (sinon la vague 3 est incomplète : signaler et s'arrêter).
- [ ] Vérifier les ancrages du socle : `src/components/page-docs/PageDocButton.tsx` existe et renvoie
  `null` ; il est inséré dans les quatre gabarits ; les quatre pages `…/docs/page.tsx` existent
  (« Bientôt disponible ») ; les entrées de menu « Documentation » existent.
- [ ] Inventaire : lister les `page.tsx` des quatre espaces et noter le nombre par espace dans le
  journal de la spec 40 (79 avant le chantier : plateforme 37, organisation 14, évènement 23, compte 5 ;
  le chantier rôles ajoute `/platform/roles`, `/platform/users/[userId]/permissions`,
  `/org/[orgId]/roles`, `/org/[orgId]/members/[userId]/permissions` et les pages du poste sur place
  AGENT ; **les pages `…/docs/**` du lot sont exclues de la découverte**, voir Task 2).
- [ ] Lire `src/lib/permissions/index.ts` : relever les exports réels (catalogue, type
  `Permission`, `loadPermissions`, `hasPermission`) ; les noms ci-dessous sont ceux de la spec 37.
  Un écart de nom → adapter ce lot, jamais le socle.
- [ ] Ajouter la dépendance de rendu dans le conteneur du worktree : `docker compose … exec app yarn
  add markdown-it && yarn add -D @types/markdown-it` (via `make -C ../badge-wt-4a`/compose du lot) ;
  vérifier `package.json` et `yarn.lock` mis à jour. Commit : `chore(deps): markdown-it pour la doc des pages`.

### Task 2: Outil — découverte, chemins de doc, sources, empreinte

**Files:**
- Create: `scripts/page-docs/discover.ts`, `scripts/page-docs/paths.ts`, `scripts/page-docs/sources.ts`,
  `scripts/page-docs/hash.ts`
- Test: `scripts/__tests__/page-docs/discover.test.ts`, `paths.test.ts`, `sources.test.ts`, `hash.test.ts`

**Interfaces — Produces** (consommées par les Tasks 3 à 5) :
```ts
export type DocSpace = "platform" | "org" | "event" | "account";
export interface PageEntry { route: string; space: DocSpace; file: string /* chemin du page.tsx relatif au dépôt */ }
export function discoverPages(root: string): PageEntry[];            // triées par route
export function docIdForRoute(route: string): string;                // "org/events/new"
export function docFileForRoute(route: string): string;              // "src/content/page-docs/org/events/new.md"
export function collectSources(root: string, pageFile: string): string[]; // triées, relatifs, page incluse
export function hashSources(root: string, sources: string[]): string;     // "sha256:<hex>"
```

- [ ] **Tests d'abord** (sur une arborescence factice créée dans un dossier temporaire du scratchpad) :
  - `discoverPages` : trouve `app/org/[orgId]/events/new/page.tsx` → route `/org/[orgId]/events/new`,
    espace `org` ; ignore les groupes de routes `(…)` dans la route, ignore `…/docs/**` (pages
    de documentation elles-mêmes), ignore `src/app/api`, `(marketing)`, `e/…`, `login`, etc. (seuls
    `platform`, `org`, `event`, `account` sont des espaces) ; résultat trié.
  - `docIdForRoute` : `/org/[orgId]/events/new` → `org/events/new` ; `/org/[orgId]` → `org/index` ;
    `/platform` → `platform/index` ; `/platform/users` → `platform/users/index` ;
    **règle de désambiguïsation** (arbitrage du lot, écart avec la spec qui n'en prévoit pas) :
    une route dont le **dernier segment est dynamique** (hors première position d'un espace) prend le
    nom `<parent>/detail`, ex. `/platform/users/[userId]` → `platform/users/detail`,
    `/org/[orgId]/events/[eventId]` → `org/events/detail` ; les segments dynamiques intermédiaires
    sont omis. Test sur les **vraies routes** du dépôt : aucun `docIdForRoute` en double
    (`it("aucune collision de chemin sur les pages réelles")`).
  - `collectSources` : page + imports relatifs et `@/` (statiques `from "…"` et dynamiques
    `import("…")`) situés sous `src/app/**` et `src/components/**`, résolus en `.ts`, `.tsx`,
    `/index.ts(x)`, jusqu'à **3 niveaux**, sans doublon, sans boucle (import circulaire), triés ;
    ignore `src/lib/**` et les paquets ; un import non résolu est ignoré.
  - `hashSources` : stable (même contenu → même empreinte), sensible à une modification d'un
    caractère d'une source, indépendant de l'ordre d'entrée et des fins de ligne CRLF/LF ; un
    fichier absent compte comme absent (empreinte différente, pas d'exception).
- [ ] Lancer : `make -C ../badge-wt-4a test FILE=scripts/__tests__/page-docs`. Expected: FAIL (modules absents).
- [ ] Implémenter les quatre modules (TypeScript pur, `node:fs`, `node:crypto`, sans dépendance
  nouvelle) selon les signatures ci-dessus ; extraction des imports par expression régulière, la
  résolution `@/` pointe sur `src/`.
- [ ] Relancer : Expected: PASS. Commit : `feat(docs-pages): decouverte des pages, sources et empreinte`.

### Task 3: Outil — format, vérification, manifestes

**Files:**
- Create: `scripts/page-docs/format.ts`, `scripts/page-docs/manifest.ts`, `scripts/page-docs/check.ts`,
  `scripts/page-docs/stamp.ts`, `scripts/page-docs/cli.ts`
- Test: `scripts/__tests__/page-docs/format.test.ts`, `manifest.test.ts`, `check.test.ts`, `stamp.test.ts`

**Interfaces — Produces :**
```ts
export interface DocFrontmatter {
  route: string; title: string; audience: "organisateur" | "staff" | "participant";
  access?: string;        // clé de permission requise pour ouvrir la page (extension du lot, voir ci-dessous)
  sources: string[]; sourceHash: string; updatedAt: string; // AAAA-MM-JJ
}
export interface ParsedDoc { frontmatter: Partial<DocFrontmatter>; body: string; bodyStartLine: number }
export function parseDoc(raw: string): ParsedDoc;
export function serializeDoc(fm: DocFrontmatter, body: string): string;     // clés dans l'ordre de la spec
export interface BlockIssue { line: number; message: string }
export function validateBlocks(body: string, knownKeys: ReadonlySet<string>): BlockIssue[];
export interface DocProblem { kind: "obsolete" | "missing" | "orphan" | "format" | "manifest"; target: string; message: string }
export function checkDocs(root: string): DocProblem[];                      // vide = tout est bon
export function stampDocs(root: string, ids: string[], today: string): string[]; // ids réellement tamponnés
export function buildManifests(root: string): { manifest: string; index: string };
export function writeManifests(root: string): void;
```
CLI (`scripts/page-docs/cli.ts`, lancé par `yarn tsx`) : `check` (affiche les problèmes groupés par
nature, code de sortie 1 s'il y en a) ; `stamp <sélecteurs…>` (code 1 si un sélecteur ne désigne
aucune doc ; **ne crée aucun fichier** : l'agent écrit le `.md` avec `route`, `title`, `audience`,
puis tamponne) ; sélecteurs acceptés : identifiant de doc (`org/events/new`), route, nom d'espace
(`org`) ou `all`.

- [ ] **Tests d'abord** :
  - `parseDoc` / `serializeDoc` : aller-retour exact sur un exemple de la spec (frontmatter
    `route`, `title`, `audience`, `sources` en liste, `sourceHash`, `updatedAt`) ; frontmatter absent
    ou YAML invalide → `frontmatter` vide sans exception (le format sera signalé par `checkDocs`).
  - `validateBlocks` : bloc `:::permission org.update` … `:::` valide ; bloc non fermé → issue avec
    la ligne d'ouverture ; `:::` orphelin → issue ; blocs imbriqués → issue ; clé absente de
    `knownKeys` → issue ; clé vide → issue.
  - `checkDocs` sur un dépôt factice du scratchpad : doc à jour → `[]` ; source modifiée →
    `obsolete` ; page sans doc → `missing` ; doc sans page → `orphan` (route inexistante ou page
    supprimée) ; frontmatter incomplet, `audience` invalide, `route` différente de celle déduite du
    chemin, clé `access` hors catalogue, **clé d'un bloc ou `access` dont la portée ne correspond pas
    à la cible de la route** (cible plateforme sans id → clés PLATFORM ; avec `[orgId]` sans
    `[eventId]` → ORG ; avec `[eventId]` → EVENT ; `/account` → PARTICIPANT) → `format` ;
    manifeste absent ou différent de `buildManifests` → `manifest`.
  - `stampDocs` : recalcule `sources`, `sourceHash`, `updatedAt` (date injectée), réécrit les
    manifestes ; une exécution répétée ne produit aucun diff (déterminisme) ; ne modifie pas le
    corps ; sélecteur inconnu → erreur explicite.
  - `buildManifests` : `manifest` exporte `PAGE_DOCS: PageDocEntry[]`
    (`{ id, route, space, title, audience, access?, updatedAt, body }`, trié par `id`) ;
    `index` exporte `PAGE_DOC_INDEX` **sans `body`** (module sûr côté client) ; les deux commencent
    par `// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).` et
    `/* eslint-disable */` ; fins de ligne `\n`, chaînes échappées par `JSON.stringify`.
- [ ] Les clés connues et leur portée proviennent de `src/lib/permissions/catalog.ts` (import direct
  par chemin relatif ou `@/` ; `tsx` résout `tsconfig.paths`). Lancer les tests : Expected: FAIL.
- [ ] Implémenter les modules ; `check.ts` regroupe les vérifications, `cli.ts` formate la sortie
  en français (une ligne par problème : nature, doc, message, action attendue : « mettre à jour le
  texte puis `make docs-stamp PAGES=…` »).
- [ ] **Extension du format** (arbitrage du lot, à journaliser dans la spec 40) : champ facultatif
  `access:` dans le frontmatter = permission que la page exige pour s'ouvrir. Il sert à filtrer la
  liste de la section Documentation (« filtrée par les permissions d'accès de chaque page ») ; sans
  lui, la doc est listée pour tout utilisateur de l'espace. Les agents le renseignent d'après la
  garde de la page.
- [ ] Relancer : Expected: PASS. Générer une première fois les manifestes vides
  (`PAGE_DOCS = []`) pour que l'application compile avant toute doc. Commit :
  `feat(docs-pages): format des docs, verification, tampon et manifestes`.

### Task 4: Cibles `docs-check` / `docs-stamp` et intégration à `lint`

**Files:**
- Modify: `Makefile` (`.PHONY`, cibles)
- Test: `scripts/__tests__/page-docs/makefile.test.ts` (lecture du Makefile : cibles présentes)

- [ ] Test : le `Makefile` déclare `docs-check` et `docs-stamp` dans `.PHONY`, `lint` appelle
  `docs-check`, `docs-stamp` échoue avec un message d'usage si `PAGES` est vide.
- [ ] Ajouter dans le `Makefile` :
  ```make
  docs-check:
  	$(DEV_COMPOSE) exec app yarn tsx scripts/page-docs/cli.ts check

  docs-stamp:
  	@test -n "$(PAGES)" || { echo "Usage : make docs-stamp PAGES=\"org/events/new platform\" (identifiants, routes, espaces ou all)"; exit 1; }
  	$(DEV_COMPOSE) exec app yarn tsx scripts/page-docs/cli.ts stamp $(PAGES)
  ```
  et faire de `lint` : `yarn lint` **puis** `docs-check` (`lint:` exécute les deux ; `make ci` et
  `make test-all` en héritent sans autre modification). Aucune autre cible du `Makefile` ne change.
- [ ] Vérifier : `make -C ../badge-wt-4a docs-check` (avec manifestes vides et des pages sans doc,
  l'outil doit signaler **« manquantes »** pour chaque page : c'est l'état attendu avant la Task 11).
  **Attention** : `make lint` est donc rouge entre cette tâche et la Task 11 ; l'enchaînement des
  tâches est séquentiel dans ce lot, aucune vérification complète n'est demandée avant la Task 11.
  Commit : `build(docs-pages): cibles docs-check et docs-stamp, docs-check dans lint`.

### Task 5: Logique serveur — appariement, cibles, blocs, rendu

**Files:**
- Create: `src/lib/page-docs/routes.ts`, `src/lib/page-docs/blocks.ts`, `src/lib/page-docs/render.ts`,
  `src/lib/page-docs/access.ts`, `src/lib/page-docs/index.ts`
- Test: `src/lib/page-docs/__tests__/*.test.ts`

**Interfaces — Consumes** : `PAGE_DOCS`, `PAGE_DOC_INDEX` (Task 3), `loadPermissions(userId, target)`
et le catalogue du socle. **Produces :**
```ts
export function matchDocRoute(pathname: string): { id: string; params: Record<string, string> } | null;
export function docTargetScope(route: string): "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT";
export async function resolveDocTarget(route: string, params: Record<string,string>): Promise<PermissionTarget | null>; // lit event.orgId en base pour [eventId]
export function filterPermissionBlocks(body: string, decide: (key: string) => boolean | undefined): string;
export function renderDocHtml(markdown: string): string;       // markdown-it, html:false, liens http/https/mailto/relatifs
export async function loadDocForUser(userId: string, pathname: string): Promise<LoadedDoc | null>; // null = pas de doc ou accès refusé
export async function listDocsForUser(userId: string, space: DocSpace, ids: { orgId?: string; eventId?: string }): Promise<DocListItem[]>;
```
- [ ] **Tests d'abord** :
  - `matchDocRoute("/org/abc123/events/new")` → `{ id: "org/events/new", params: { orgId: "abc123" } }` ;
    `/org/abc123` → `org/index` ; chemin sans doc (`/org/abc/unknown`) → `null` ; `/e/slug`, `/login`,
    `/api/…` → `null` ; segments avec query/hash/slash final tolérés ; pas de traversée de chemin.
  - `docTargetScope` : mêmes règles que `docs-check` (une seule table partagée, importée par l'outil
    pour éviter la dérive : l'outil importe `docTargetScope` de `src/lib/page-docs/routes.ts`).
  - `filterPermissionBlocks` : `decide → true` garde le contenu sans marqueurs ; `false` retire le
    bloc entier (titre compris) ; `undefined` garde le contenu avec la ligne
    `*Réservé aux utilisateurs disposant de la permission « <label du catalogue> ».*` ; bloc mal
    formé : texte conservé, marqueurs retirés, aucune exception.
  - `renderDocHtml` : titres, listes, tableaux, gras, liens ; `<script>` et HTML brut échappés ;
    `javascript:` neutralisé ; une doc réelle de l'espace pilote se rend sans erreur.
  - `loadDocForUser` (vrai MySQL, fabriques) : OWNER voit le bloc `org.update`, AUDITOR non ;
    doc sans bloc ; utilisateur sans aucune permission sur la cible → `null` ; compte archivé →
    `null` ; `[eventId]` d'une autre organisation que celle de l'utilisateur → `null` ;
    `STAFF_PRINTER` sur une page `/platform/organizations` → `null` ou doc selon `access`.
  - `listDocsForUser` : exclut les docs dont `access` n'est pas détenu ; garde celles sans `access` ;
    triées par titre dans l'ordre du menu de l'espace (ordre d'`id`).
- [ ] Implémenter : appariement par motif construit depuis les `route` de l'index (segments
  `[x]` → un segment non vide) ; permissions via `loadPermissions` du socle ; cible `org` pour
  `/platform/organizations/[orgId]/…`, `event` quand `[eventId]` est présent (orgId lu en base) ;
  `participant` pour `/account` ; participant : tout compte valide.
- [ ] Lancer `make -C ../badge-wt-4a test FILE=src/lib/page-docs`. Expected: PASS, couverture 100 %
  du dossier. Commit : `feat(docs-pages): appariement des routes, blocs de permission et rendu`.

### Task 6: Route `GET /api/page-docs`

**Files:**
- Create: `src/app/api/page-docs/route.ts`
- Test: `src/app/api/page-docs/__tests__/route.test.ts`

**Interfaces — Produces :** `GET /api/page-docs?path=<pathname>` →
`200 { id, title, updatedAt, html, docsHref }` ; `401` non connecté ; `404 { error: "NOT_FOUND" }` si
aucune doc ou accès refusé (même réponse : on ne révèle pas l'existence) ; `400` si `path` manque
ou dépasse 300 caractères. `docsHref` = lien « Toute la documentation » vers
`…/docs/<slug>` de l'espace. Aucune donnée sensible dans la réponse ; en-tête
`Cache-Control: private, no-store`.

- [ ] **Tests d'abord** (vrai MySQL, session mockée) : 401 sans session ; 400 sans `path` ; 404 pour
  une page sans doc ; 404 pour un utilisateur sans permission ; 200 avec `html` filtré (le contenu
  d'un bloc `:::permission` non détenu **n'apparaît pas** dans la réponse JSON entière) ; compte
  archivé → 401/403 ; la route n'appelle aucune API externe.
- [ ] Implémenter en vérifiant la session par le helper du projet (`getServerSession`/helpers de
  `src/lib/auth.ts`) puis `loadDocForUser`. Cette route est une **lecture** : pas de `logActivity`.
- [ ] `make -C ../badge-wt-4a test FILE=src/app/api/page-docs` : Expected: PASS, 100 %. Commit :
  `feat(docs-pages): route api de lecture de la doc d'une page`.

### Task 7: `PageDocButton` réel et panneau latéral

**Files:**
- Modify: `src/components/page-docs/PageDocButton.tsx` (remplace le composant vide du socle)
- Create: `src/components/page-docs/PageDocPanel.tsx`, `src/components/page-docs/DocBody.tsx`
- Test: `src/components/page-docs/__tests__/PageDocButton.test.tsx` (Vitest, jsdom si déjà utilisé par
  les tests de composants du projet ; sinon couverture par l'e2e de la Task 12)

**Interfaces — Produces :** `<PageDocButton />` (client, sans props : le socle l'insère tel quel) ;
`<DocBody html={string} />` (server-compatible, enveloppe de style) ;
`<PageDocPanel open onClose title updatedAt html docsHref />`.

- [ ] Comportement : `usePathname()` ; le bouton « ? » (icône d'aide du projet, `aria-label="Aide sur
  cette page"`) n'est rendu que si `matchDocRoute`-équivalent côté client (sur `PAGE_DOC_INDEX`, module
  client sans corps) trouve une doc pour le chemin courant ; au clic, `fetch('/api/page-docs?path=…')`
  puis panneau : titre, corps (`DocBody`), « Mise à jour le <date> » (format `src/lib/format-date.ts`),
  lien « Toute la documentation » ; états de chargement, d'erreur (message français, bouton
  « Réessayer ») ; 404 → le bouton disparaît. Réutiliser `src/components/ui/Dialog.tsx`/`Modal.tsx`
  s'ils couvrent le panneau latéral (focus piégé, `Escape`), sinon un panneau `fixed inset-y-0
  right-0` de largeur `w-full sm:max-w-md lg:max-w-lg` (plein écran sous `sm`), `role="dialog"`,
  `aria-modal`, focus rendu au bouton à la fermeture. Le panneau se ferme au changement de page.
- [ ] `DocBody` applique des classes Tailwind de descendance (`[&_h2]:…`, `[&_ul]:…`, `[&_table]:…`)
  avec `overflow-x-auto` sur les tableaux ; palette du projet (nouvelle palette, classes existantes).
- [ ] Test : bouton absent sans doc ; présent avec doc ; clic → appel `fetch` attendu → titre et
  corps affichés ; `Escape` ferme (si jsdom disponible, sinon couvert en e2e).
- [ ] Vérifier dans le navigateur (stack 4a) sur une page sans doc : aucun bouton, aucune erreur
  console. Commit : `feat(docs-pages): bouton d'aide et panneau lateral`.

### Task 8: Pages Documentation des quatre espaces

**Files:**
- Modify (remplace les pages d'attente du socle) : `src/app/platform/docs/page.tsx`,
  `src/app/org/[orgId]/docs/page.tsx`, `src/app/event/[eventId]/docs/page.tsx`, `src/app/account/docs/page.tsx`
- Create : `…/docs/[...slug]/page.tsx` dans les quatre espaces ; `src/components/page-docs/DocsIndex.tsx`,
  `src/components/page-docs/DocArticle.tsx`

**Interfaces — Consumes :** `listDocsForUser`, `loadDocForUser`-équivalent par identifiant
(`loadDocById(userId, id, ids)` à ajouter dans `src/lib/page-docs/index.ts` avec son test si
l'implémentation de la Task 5 ne l'expose pas encore).

- [ ] Liste : titre de page, intro d'une phrase, docs de l'espace groupées par section (premier
  segment de l'id) avec titre et résumé (première phrase du corps) ; état vide (« Aucune
  documentation disponible pour votre profil ») ; `EmptyState`/`PageHeader` du projet.
- [ ] Lecture : `…/docs/<slug>` où `slug` = id sans le préfixe d'espace (`events/new`) ; fil d'Ariane
  retour à la liste ; corps via `DocBody` ; blocs filtrés selon la cible de l'espace (blocs de portée
  différente conservés avec la mention « Réservé… », règle de la Task 5) ; `notFound()` si la doc
  n'existe pas ou n'est pas permise ; `Cache`/`dynamic` : rendu dynamique (permissions par
  utilisateur).
- [ ] Les gardes des pages sont celles de l'espace (layouts existants) ; `/account/docs` pour tout
  compte connecté ; aucune permission supplémentaire inventée.
- [ ] Contrôle navigateur à 375, 1024 et 1280 px sur les quatre listes et une lecture. Commit :
  `feat(docs-pages): sections documentation des quatre espaces`.

### Task 9: Consignes pour les agents IA

**Files:** `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/skills/chantier/SKILL.md`,
`.claude/skills/chantier/orchestrator-template.md`. `AGENTS.md` est un **lien symbolique vers
`CLAUDE.md`** : le modifier à part casserait le lien ; la section ajoutée à `CLAUDE.md` vaut donc
aussi pour `AGENTS.md`. Vérifier qu'il reste un lien : `ls -l AGENTS.md` → `AGENTS.md -> CLAUDE.md`.

- [ ] Ajouter dans `CLAUDE.md`, après « Règles d'écriture spécifiques », la section ci-dessous
  (texte à reprendre tel quel ; c'est la consigne unique que les sous-agents de la vague 5 reçoivent) :

  ```markdown
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
  1. Lis la page et ses composants (`make docs-check` liste les docs obsolètes et leurs sources).
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
    `:::` (clé du catalogue `src/lib/permissions/catalog.ts`, de la **même portée que la page** :
    plateforme sans identifiant → clés PLATFORM ; `[orgId]` → ORG ; `[eventId]` → EVENT ;
    `/account` → PARTICIPANT ; pas de blocs imbriqués).

  **Rédaction** : français avec accents, vouvoiement, ton du guide utilisateur ; public =
  organisateurs et staff ; n'explique que ce que l'écran montre, avec les libellés exacts de
  l'interface ; ne rien inventer ; jamais de secret, de jeton, ni de donnée personnelle réelle
  (exemples fictifs seulement).
  ```
  Ajouter aussi, dans « Actions à risque » ou « Workflow Git — valeurs projet », une ligne :
  « **Avant tout commit** : `make docs-check` (inclus dans `make lint`) ». Rappel `AGENTS.md` :
  couvert par le lien ; en cas de lien rompu par un outil, le rétablir (`ln -sf CLAUDE.md AGENTS.md`).
  `.cursor/rules/project.mdc` pointe vers `CLAUDE.md` mais n'est pas dans le périmètre du lot :
  s'il faut y répéter la règle, le signaler.
- [ ] `.claude/CLAUDE.md` (template générique), section 3 « Règles d'écriture de code » : ajouter la
  règle générique « **Documentation utilisateur liée** : quand le projet documente ses écrans ou ses
  fonctions pour les utilisateurs, mettre à jour cette documentation dans le même changement que le
  code, selon la consigne du `CLAUDE.md` projet ; ne pas livrer de code dont la doc est obsolète ».
- [ ] `.claude/skills/chantier/SKILL.md`, § 2 (« Chaque plan contient obligatoirement ») : la dernière
  tâche « e2e, doc, vérification » inclut « mettre à jour les docs des pages du lot
  (`make docs-stamp`) et `make docs-check` vert » ; § 1, vague de fusion : « vérifier `make
  docs-check` ». `orchestrator-template.md` : dans la vague 2, la consigne du sous-agent de lot cite
  la mise à jour des docs de pages ; dans la vague 3 (fusion), ajouter `make docs-check` à la
  vérification (`make lint && make typecheck && make test-coverage && make docs-check`, ce dernier
  étant déjà dans `lint`, le préciser) et un rappel de re-tamponner les docs des pages touchées par
  les deux côtés d'un conflit.
- [ ] Commit : `docs: consignes de documentation des pages pour les agents et le skill chantier`.

### Task 10: Doc de feature `documentation-pages.md`

**Files:** Create `docs/v4/features/documentation-pages.md` ; Modify `docs/v4/README.md` si la liste
des features y est tenue.

- [ ] Rédiger (style des features existantes, ex. `docs/v4/features/politique-tests.md`) : objectif et
  public ; format d'une doc (frontmatter dont `access`, blocs `:::permission`, correspondance route →
  fichier avec la règle `detail`/`index`) ; outil (`discover`, `sources`, `hash`, `check`, `stamp`,
  manifestes `manifest.generated.ts` et `index.generated.ts`) ; commandes `make docs-check` et
  `make docs-stamp PAGES=…` avec les sélecteurs ; intégration à `make lint`/`make ci` ; interface
  (bouton, panneau, section Documentation, `GET /api/page-docs`) ; filtrage par permission et règle de
  portée ; consigne aux agents (renvoi à la section de `CLAUDE.md`) ; non-objectifs de la spec.
  Pas de duplication de la consigne : un renvoi.
- [ ] Commit : `docs: feature documentation des pages`.

### Task 11: Pilote — docs des pages `/org`

- [ ] Lister les pages de l'espace : `make -C ../badge-wt-4a docs-check` (état « manquantes »). Le
  nombre exact est celui de la découverte (14 annoncées par la spec avant le chantier rôles, plus
  `/org/[orgId]/roles` et `/org/[orgId]/members/[userId]/permissions`).
- [ ] Pour chaque page `/org`, **suivre la consigne de la section « Documentation des pages » de
  `CLAUDE.md`** : lire la page et ses composants, écrire `src/content/page-docs/org/<chemin>.md`
  (frontmatter `route`, `title`, `audience`, `access`), corps structuré, blocs `:::permission` là
  où l'écran se divise par droit (modifier l'organisation, gérer les membres, créer un évènement,
  payer l'abonnement, rôles…), libellés exacts de l'interface. Sous-agent possible (un seul, Sonnet),
  mais relecture par l'agent du lot écran par écran.
- [ ] `make -C ../badge-wt-4a docs-stamp PAGES=org`, puis `make … docs-check` : vert (aucune
  obsolète, manquante, orpheline ; format valide).
- [ ] Relecture croisée de l'échantillon : trois pages ouvertes dans le navigateur avec le bouton « ? »
  en OWNER, MANAGER et AUDITOR : les blocs correspondent aux droits ; aucune option citée qui n'est
  pas à l'écran ; aucun secret ni donnée personnelle. Consigner dans la spec 40 les ajustements de
  consigne appris du pilote (format, longueur, ton), puis reporter ces ajustements dans la section de
  `CLAUDE.md` avant la vague 5. Commit : `docs(pages): documentation des pages de l'espace organisation`.

### Task 12: e2e, doc, vérification

- [ ] e2e : `e2e/transverse/page-docs.spec.ts` (un `describe` « Documentation des pages », fixtures
  préfixées nettoyées via `e2e/helpers/db.ts`) :
  - OWNER sur une page `/org/[orgId]/…` documentée : le bouton « ? » ouvre le panneau, titre et corps
    visibles, `Escape` ferme, le focus revient au bouton ;
  - AUDITOR : un bloc réservé à `org.update` est absent du panneau ;
  - page sans doc (ex. `/org/[orgId]/docs` elle-même) : pas de bouton ;
  - `/org/[orgId]/docs` liste les docs, un clic ouvre la lecture `…/docs/<slug>` ; une doc
    inexistante → 404 ;
  - `/platform/docs`, `/event/[eventId]/docs`, `/account/docs` répondent 200 et affichent l'état vide
    (ou la liste) selon les docs présentes ;
  - 375 px : le panneau occupe tout l'écran, aucun défilement horizontal ; 1024 et 1280 px : panneau
    à droite, le contenu de la page reste utilisable.
- [ ] Vérifier le déterminisme : `make docs-stamp PAGES=all` deux fois de suite → `git diff` vide la
  seconde fois.
- [ ] `make -C ../badge-wt-4a lint && make … typecheck && make … test-coverage` : lint (incluant
  `docs-check`) 0 erreur, typecheck OK, tests verts, couverture 100 % sur `src/lib/**` et
  `src/app/api/**` ; puis `make … test-e2e FILE=e2e/transverse/page-docs.spec.ts`. Sous charge
  (`uptime` > 30) : rejouer le fichier seul avant de conclure.
- [ ] Contrôle navigateur à **375, 1024 et 1280 px** du bouton, du panneau, des quatre sections ;
  console sans erreur ; viewport remis à `desktop`.
- [ ] Mettre à jour la spec 40 (statut « implémentée — <date> », journal : arbitrages — règle
  `detail`, champ `access`, deux manifestes, ajouts `src/lib/page-docs`, `api/page-docs`, e2e,
  `AGENTS.md` symlink, effectifs de pages), le tracker de ce plan, et rédiger le rapport
  `.superpowers/sdd/roles-permissions/lot-4a-report.md` (état « prêt à fusionner »).

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. Arbitrages acceptés (journalisés dans la spec 40) : `src/lib/page-docs/**`,
   `src/app/api/page-docs/route.ts`, `e2e/transverse/page-docs.spec.ts` ajoutés aux
   exclusifs ; règle `<parent>/detail` pour un dernier segment dynamique ; champ `access:`
   facultatif ; portée des blocs `:::permission` = portée de la cible de la page ; deux
   modules générés (corps serveur / index client) ; `markdown-it` (`html: false`) ;
   `AGENTS.md` est un lien vers `CLAUDE.md` (une seule consigne) ; nombre de pages relevé en
   Task 1 (plus de 79).
