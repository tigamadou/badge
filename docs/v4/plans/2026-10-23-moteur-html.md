# Moteur HTML du badge — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Branche, montée à 2.0.0, module de l'exporteur et service `renderer` de dev | [x] | 2026-10-26 | Accords utilisateur 2026-10-26 (suite non verte T1-T6, compose dev/prod/preprod, deploy.sh, .env.production.example). Branche deja creee. Moteur 2.0.0 exact ; renderer.test.ts 7 tests, 100 % sur renderer.ts ; renderer dev healthy, /health 200 depuis app. Pas de commit (l'utilisateur commite). |
| 2 | Lecture des layouts au format 3 et résolution sans `@react-pdf` | [x] | 2026-10-26 | resolve.test.ts (35 tests) + reference-packages + event-template-variables verts, resolve.ts 100 %. Tests dependant du seed verts apres T4. Manifestes livres migres (formatVersion seul change). Pas de commit. |
| 3 | Rendu d'un badge en HTML, document figé et PDF | [x] | 2026-10-26 | render-badge.test.ts 11 tests verts ; render-badge.ts 100 % (lignes d'options image couvertes par les tests de route, a confirmer au run complet). Photo trop lourde simulee via __TEST__.readFileAsDataUrl (21 Mo). Pas de commit. |
| 4 | Épreuve `proof.png` à l'installation | [x] | 2026-10-26 | install.test.ts + routes platform/badge-templates : 64 tests verts, install.ts et route.ts 100 %. Ancien test 'police invalide' remplace par failNext(RENDER_FAILED) (le faux exporteur ne rend plus la police). Pas de commit. |
| 5 | Routes du badge (`PDF`, `?format=html`) et du ZIP | [ ] |  |  |
| 6 | `verify-engine`, export du corpus et validation au format 3 | [ ] |  |  |
| 7 | Script de migration des templates installés vers le format 3 | [ ] |  |  |
| 8 | Service `renderer` en production, préproduction et CI | [ ] |  |  |
| 9 | `BadgeDocumentView` et les écrans d'impression | [ ] |  |  |
| 10 | Épreuve PNG au catalogue et sur la page de détail | [ ] |  |  |
| 11 | Suppression du code mort et de `@react-pdf/renderer` | [ ] |  |  |
| 12 | Parcours E2E, dont la page d'un badge à 375 px | [ ] |  |  |
| 13 | Documentation de déploiement et vérification finale | [ ] |  |  |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la ligne de la tâche dans le même commit que son code (tests verts et critères d'acceptation remplis). En cas d'interruption, passez la ligne à `[~]` et notez précisément l'état (étape en cours, fichiers touchés, prochaine étape). Avant chaque session, lire ce tableau pour savoir où l'on s'était arrêté.

**Prérequis :** `@tigamadou/pdf-engine@2.0.0` publié (GitHub Packages) et `ghcr.io/tigamadou/pdf-engine-renderer:2.0.0` disponible (GHCR). Sans les deux, ne pas commencer. **Remplis le 2026-10-26** (workflow « Publication du moteur », run 40256433474, tag `engine-v2.0.0` sur le commit `765c6fa` de pdfStudio). L'image n'est publiée qu'en **linux/amd64** (plateforme du VPS de production) : sur un Mac Apple Silicon, elle tourne sous émulation (Rosetta), voir la tâche 1.

**Accords à obtenir de l'utilisateur avant l'exécution :**

1. **Suite non entièrement verte pendant les tâches 1 à 6** : la montée à 2.0.0 casse tout le module `badge-templates` d'un coup. Seuls les tests ciblés de la tâche sont exigés avant chaque commit jusqu'à la tâche 7 ; `make lint`, `make typecheck` et `make test` complets redeviennent obligatoires à partir de la fin de la tâche 7 ; **aucun push avant**. C'est un écart à la règle « `make lint && make typecheck && make test` avant tout commit » de `CLAUDE.md`.
2. **Modification des fichiers `docker-compose*.yml` et `Dockerfile*`** (classés « actions à risque » par `CLAUDE.md`) : tâche 1 (`docker-compose.dev.yml`) et tâche 8 (`docker-compose.yml`, `docker-compose.preprod.yml`, ainsi que `deploy.sh` et `.env.production.example`). Aucun `Dockerfile*` n'est modifié par ce plan (la tâche 13 n'en construit qu'une image locale) ; si cela change, redemander.

**Goal:** Faire rendre les badges par le moteur HTML 2.0.0 et le service de rendu : aperçu `<page-view>` lisible sur mobile, PDF et ZIP par le service, épreuve PNG, migration des templates installés au format 3, suppression de `@react-pdf`.

**Architecture:** Un module serveur unique (`src/lib/renderer.ts`) fournit l'`Exporter` (client du service `renderer`, injectable pour les tests). Un badge est rendu en `HtmlDocument` vivant par `renderHtml` (pur, dans le processus Next), puis figé ou converti en PDF par le service. Le navigateur reçoit le document figé en JSON et l'affiche dans `<page-view>` (composant web du package, enregistré côté client). Les lignes `InstalledBadgeTemplate` au format 2 sont migrées en mémoire à la lecture (aucune interruption au déploiement), puis réécrites en base par un script.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 6 / MySQL 8, Vitest 4 (couverture v8 100 %), Playwright, Yarn (Corepack), Docker Compose, `@tigamadou/pdf-engine` 2.0.0, image `ghcr.io/tigamadou/pdf-engine-renderer:2.0.0`.

**Spec :** spec dans le dépôt pdfStudio : docs/superpowers/specs/2026-09-23-studio-v3-canvas-design.md (section L'application badge). Les sections « `<page-view>` », « `Exporter` », « Erreurs » et « Tests » de la même spec en précisent le contexte ; la référence des API est le `README.md` et le `CHANGELOG.md` du package `@tigamadou/pdf-engine` 2.0.0.

**Dépendances :** voir « Prérequis » en tête. Ce plan ne débloque aucun autre plan.

**Branche :** `feat/moteur-html`, créée depuis `development`.

**Zone de fichiers :** ce dépôt (badge) uniquement.

**Suivi :** le tableau `## Progression` de ce fichier, mis à jour à chaque tâche dans le même commit que le code.

**Note sur les textes de repli :** les textes de repli (`fallbackTexts`) d'un bloc texte sont livrés dans le moteur 2.0.0 (plan A7 de pdfStudio, publié). Le template ex-305v installé dans badge doit être **réinstallé depuis le studio** à la fin de ce plan, pour que le nom du participant tienne sur deux lignes avec repli « A. Nom » puis « Nom ». Cela ne bloque aucune tâche de ce plan.

**Note sur les traits d'union :** le moteur 2.0.0 place un WORD JOINER (U+2060, invisible) derrière chaque trait d'union collé à ses voisins (« Anne-Marie »), pour interdire la coupure de ligne à cet endroit. Il est présent dans le HTML du **document vivant** (`renderHtml`) et retiré au **figement** (`freeze`). Un test qui cherche un nom composé dans `document.html` d'un document vivant compare donc `document.html.replaceAll("⁠", "")`.

## Global Constraints

- Branche `feat/moteur-html` créée depuis `development` — **jamais de travail direct sur `development`**, fusion par PR.
- Commits en français, **ASCII sans accents**, `feat(badges): …`, `chore(badges): …`, `test(badges): …`, `docs(badges): …`, **aucune ligne de co-auteur** ni mention d'outil. **Ne commiter que sur demande de l'utilisateur** : les étapes « commiter » ci-dessous décrivent le commit à proposer, pas une autorisation. Si le hook RTK bloque `git`, utiliser `/usr/bin/git`.
- À la fin de CHAQUE tâche : cocher ses cases et mettre à jour sa ligne de `## Progression` (statut, date, notes : commandes de vérification et résultat, écarts). La mise à jour fait partie du commit de la tâche.
- Toutes les commandes Node du dépôt badge tournent dans le conteneur de dev : `docker compose -f docker-compose.dev.yml exec app <commande>`. Tests : `… exec app yarn vitest run <chemin>`. Un run Vitest **vide la base** : relancer ensuite `… exec app yarn prisma db seed`. Ne jamais lancer deux runs Vitest en parallèle.
- **Ne jamais construire l'image de production sous son nom par défaut en local** (`ghcr.io/tigamadou/badge:*`) : pour vérifier le Dockerfile, utiliser un tag local (`badge-verif:local`).
- Le `CLAUDE.md` du dépôt badge classe la modification de `docker-compose*.yml`, `Dockerfile*`, `.env*` et `Caddyfile` parmi les actions à risque : **demander l'accord de l'utilisateur** avant les étapes qui les touchent (tâches 1 et 8, voir « Accords » en tête), et le noter dans les notes de la tâche.
- Couverture Vitest **100 %** (lignes, branches, fonctions, instructions) sur `src/lib/**` et `src/app/api/**` ; les composants React sont couverts par l'E2E et par des tests `renderToStaticMarkup`.
- Versions **exactes** : `"@tigamadou/pdf-engine": "2.0.0"` dans `package.json`, image `ghcr.io/tigamadou/pdf-engine-renderer:2.0.0` dans les trois compose et la CI. Le tag de l'image est toujours égal à la version du moteur.
- Le service `renderer` n'est **jamais exposé** (aucune entrée `ports:` hors CI) et tourne sur un **réseau compose interne** (`internal: true`, sans accès sortant) partagé avec `app` et `tools` seulement : il rend du HTML fourni par l'appelant et ne doit joindre ni Internet ni le réseau interne. Il écoute sur le port **3000**, répond à `GET /health`, et `app` le joint par `RENDERER_URL`. Dans chaque compose : `init: true` (Chromium crée des processus enfants) et `stop_grace_period: 30s` (le délai de grâce du service est de 20 s ; les 10 s par défaut de Docker tueraient des rendus en cours).
- Ressources d'un badge : images et polices **intégrées en data URL** (`buildValues`, `loadAssetResolver`) ; aucune route d'asset nouvelle. C'est imposé par le moteur : la CSP du document vivant est `default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'`, toute autre URL est bloquée.
- Règle de confiance de `<page-view>` : un document vivant exécute son script dans une iframe de même origine. **badge ne passe à la vue que des documents figés** (`frozen: true`, montés par le composant avec `sandbox="allow-same-origin"`), jamais un document vivant reçu d'un serveur.
- Erreurs d'export (`ExportError`, `/export`) : `UNAVAILABLE` (503) et `TIMEOUT` (504) = service indisponible ou lent ; `RENDER_FAILED` (500) = échec du rendu, y compris un document dont le script d'exécution a posé `data-pe-error` sur `<html>` (l'export le transforme en `RENDER_FAILED`) ; `INVALID_PAGE` (400) = page demandée absente. Bornes d'une image (`Exporter.image`) : `scale` dans ]0, 4], `quality` entière dans [1, 100], `largeur × hauteur × scale²` au plus 50 000 000 de pixels, sinon `RENDER_FAILED`. badge n'utilise que les valeurs par défaut (PNG, `scale` 1, `quality` 90).
- Message d'indisponibilité, exact : `RENDERER_UNAVAILABLE_MESSAGE = "Le service de rendu des badges est indisponible. Réessayez dans un instant."` ; libellé de l'aperçu en échec, exact : `Aperçu indisponible, réessayer`.
- **Exception de bascule** : la montée à 2.0.0 casse tout le module `badge-templates` d'un coup. Pendant les tâches 1 à 6, seuls les tests ciblés de la tâche doivent passer avant le commit (écart à la règle « lint + typecheck + test avant commit » du dépôt, **à faire valider par l'utilisateur avant l'exécution**, voir « Accords » en tête et à noter dans `## Progression`) ; **à partir de la fin de la tâche 7** (dernier code qui dépend de l'API 1.x : `engine-upgrade.ts` en tâche 6, script de migration v2 en tâche 7), `make lint`, `make typecheck` et `make test` sont verts à chaque commit. Aucun push avant la fin de la tâche 7.

### Interfaces du moteur 2.0.0 et du service de rendu (vérifiées dans le code publié)

```ts
// @tigamadou/pdf-engine (racine)
// 2 -> 3, idempotent sur un format 3, lève sur un format 1 ou inconnu, ne modifie pas son entrée.
export function migrateManifest(input: unknown): unknown;
// @tigamadou/pdf-engine/proof — `html` est le document FIGÉ complet, `png` la page 1.
// Une ExportError est relevée telle quelle ; toute autre erreur est préfixée « renderProof <templateId> : ».
export function renderProof(manifest: TemplateManifest, assets: PackageAsset[], templateId: string, exporter: Exporter): Promise<{ html: HtmlDocument; png: Uint8Array }>;
// @tigamadou/pdf-engine/testing — empreinte stable : une ligne de dimensions, puis le HTML dont
// chaque data URL est remplacée par le hachage de sa charge.
export function htmlFingerprint(doc: HtmlDocument): string;
// @tigamadou/pdf-engine/export
export type ExportErrorCode = "UNAVAILABLE" | "TIMEOUT" | "RENDER_FAILED" | "INVALID_PAGE";
export class ExportError extends Error { readonly code: ExportErrorCode }
export interface Exporter { freeze(doc): Promise<HtmlDocument>; pdf(doc): Promise<Uint8Array>; image(doc, opts: ImageOptions): Promise<Uint8Array> }
export type ImageOptions = { format: "png" | "jpeg" | "webp"; page: number /* dès 1 */; scale?: number; quality?: number };
export const RENDERER_MAX_BODY_BYTES: number; // 20 Mo
// @tigamadou/pdf-engine/export/service
export function createServiceExporter(options: { url: string; timeoutMs?: number /* 30000 */; fetch?: typeof fetch }): Exporter;
// `freeze` d'un document déjà figé le renvoie tel quel ; `pdf` et `image` figent eux-mêmes un document vivant.
// Service de rendu : image ghcr.io/tigamadou/pdf-engine-renderer:2.0.0 (jamais `latest`),
// port 3000, GET /health -> 200 { ok, version, browser, active, queued } (503 sans navigateur) ;
// variables RENDERER_CONCURRENCY (4), RENDERER_TIMEOUT_MS (25000), RENDERER_MAX_QUEUE (100),
// RENDERER_MAX_BODY_BYTES (20 Mo), RENDERER_SHUTDOWN_GRACE_MS (20000) ; l'image a son propre HEALTHCHECK.
// Image publiée en linux/amd64 seulement (pas de variante arm64).
// Format 3 (2.0.0) : 150 blocs au plus par manifeste (groupes et enfants compris) ; types de blocs
// text, rect, square, circle, list, group et, livrés aussi dans la 2.0.0, les formes vectorielles
// ellipse (fond fill et/ou image, comme rect), line, polygon et path (sans image). Le cadre d'un bloc texte masque
// ce qui le dépasse (overflow: hidden), à l'écran comme dans le PDF.
// <page-view> (@tigamadou/pdf-engine/viewer) : height: 100 %, minimum 160 px — le conteneur DOIT lui donner une hauteur.
// Événements : PAGE_VIEW_EVENTS = { ready: "pe-ready", page: "pe-page", zoom: "pe-zoom" }.
// Un document figé tient son signal prêt du chargement (pas de script) ; sur `data-pe-error` ou sans
// signal après le délai de secours, la vue devient utilisable SANS émettre `pe-ready`.
```

Les noms et signatures ci-dessus ont été relevés dans `packages/engine` (2.0.0) du dépôt pdfStudio. Si une signature publiée diffère à l'exécution : s'arrêter et le signaler, ne pas l'adapter en silence. `@tigamadou/pdf-engine/package.json` reste exporté (`ENGINE_VERSION`).

## Review Focus

- **Service de rendu arrêté ou lent** : la page d'un badge affiche « Aperçu indisponible, réessayer », la route répond 503 avec `RENDERER_UNAVAILABLE_MESSAGE`, l'installation d'un template répond 503 (pas « paquet invalide »), le ZIP répond 503. Tests : tâches 1, 4, 5, 7, 12.
- **Badge trop lourd** (photo, logo et bannière de 5 Mo chacun, en base64) : le corps dépasse la limite de 20 Mo du service. Attendu : erreur explicite côté serveur avant l'appel (« document du badge trop volumineux »), 500 `RENDER_FAILED` avec ce message. Test : tâche 3.
- **Changement rapide de badge dans l'impression en lot** : une réponse périmée ne doit jamais remplacer l'aperçu du badge sélectionné. Test E2E : tâche 12 (`data-src` = badge courant).
- **Fenêtre entre le déploiement et la migration** : une ligne encore au format 2 doit s'imprimer (migration en mémoire) et passer `verify-engine` ; une ligne au format 1 est refusée avec un message qui nomme `make migrate-installed-templates`. Tests : tâches 2 et 6.
- **Polices absentes de l'image standalone** : `montserratFaces()` lit des TTF du package au runtime ; le traçage de Next peut les oublier. Attendu : les fichiers sont dans `.next/standalone`. Vérification : tâche 13 (build + `ls`).

---

### Task 1: Branche, montée à 2.0.0, module de l'exporteur et service `renderer` de dev

**Files:**
- Modify: `package.json`, `yarn.lock` (`@tigamadou/pdf-engine` → `2.0.0` exact)
- Create: `src/lib/renderer.ts`, `src/lib/__tests__/renderer.test.ts`
- Create: `src/lib/__tests__/helpers/fake-exporter.ts`
- Modify: `src/test-setup.ts` (installe le faux exporteur avant chaque test)
- Modify: `next.config.ts`
- Modify: `docker-compose.dev.yml` (service `renderer`, `RENDERER_URL`, dépendance de `app`) — **accord utilisateur requis**

**Interfaces:**
- Consumes: `Exporter`, `ExportError`, `ExportErrorCode`, `HtmlDocument`, `ImageOptions` (`@tigamadou/pdf-engine/export`, `/html`), `createServiceExporter` (`/export/service`).
- Produces:

```ts
// src/lib/renderer.ts
export const RENDERER_TIMEOUT_MS = 30_000;
export const RENDERER_UNAVAILABLE_MESSAGE = "Le service de rendu des badges est indisponible. Réessayez dans un instant.";
export function getExporter(): Exporter;                 // mémoïsé par valeur de RENDERER_URL
export function overrideExporter(exporter: Exporter | null): void; // tests uniquement ; null rétablit le service
export function isRendererUnavailable(err: unknown): err is ExportError; // code UNAVAILABLE ou TIMEOUT
export function rendererUnavailableResponse(): NextResponse; // 503 { error: "RENDERER_UNAVAILABLE", message }, en-tête retry-after: 5

// src/lib/__tests__/helpers/fake-exporter.ts
export type FakeCall = { op: "freeze" | "pdf" | "image"; doc: HtmlDocument; opts?: ImageOptions };
export type FakeExporter = Exporter & { calls: FakeCall[]; failNext(code: ExportErrorCode): void; reset(): void };
export const fakeExporter: FakeExporter;      // singleton posé par test-setup
export const FAKE_PNG: Uint8Array;            // PNG 1×1 valide
export function countPdfPages(buf: Uint8Array): number;
```

Comportement du faux : `freeze` → `{ ...doc, frozen: true, html: doc.html sans <script>…</script> et sans U+2060 }` (comme le vrai figement, voir « Note sur les traits d'union ») ; `pdf` → `%PDF-1.7\n` + un `<< /Type /Page >>` par élément de `doc.pages` + `%%EOF` ; `image` → `FAKE_PNG` ; `failNext(code)` fait rejeter l'appel suivant avec `new ExportError(code, "faux exporteur")` (`RENDER_FAILED` représente aussi un document en erreur `data-pe-error`).

- [ ] **Step 1: Créer la branche**

Run: `cd /Users/amadou/Devs/projects/badge && /usr/bin/git switch development && /usr/bin/git pull && /usr/bin/git switch -c feat/moteur-html`
Expected: `Switched to a new branch 'feat/moteur-html'`.

- [ ] **Step 2: Monter le moteur**

Run: `docker compose -f docker-compose.dev.yml exec app yarn add @tigamadou/pdf-engine@2.0.0 --exact`
Expected: `package.json` contient `"@tigamadou/pdf-engine": "2.0.0"` ; `ls node_modules/@tigamadou/pdf-engine/dist/export/service.js` existe dans le conteneur.

- [ ] **Step 3: Écrire le test qui échoue** — `renderer.test.ts`

- `getExporter()` sans `RENDERER_URL` : `freeze(doc)` rejette une `ExportError` de code `UNAVAILABLE` dont le message contient `RENDERER_URL` (aucune exception au chargement du module : `next build` importe les routes).
- Avec `RENDERER_URL=http://127.0.0.1:1` : deux appels renvoient la même instance ; `pdf(doc)` rejette `ExportError` `UNAVAILABLE` (connexion refusée, traduite par l'adaptateur service).
- `overrideExporter(fake)` : `getExporter() === fake` ; `overrideExporter(null)` rétablit le service.
- `isRendererUnavailable` : vrai pour `UNAVAILABLE` et `TIMEOUT`, faux pour `RENDER_FAILED`, `INVALID_PAGE`, une `Error` ordinaire, `undefined`.
- `rendererUnavailableResponse()` : statut 503, `retry-after` `5`, corps `{ error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE }`.

- [ ] **Step 4: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/renderer.test.ts`
Expected: FAIL (module `../renderer` introuvable).

- [ ] **Step 5: Implémenter `renderer.ts`, le faux exporteur et `test-setup.ts`**

`getExporter` lit `process.env.RENDERER_URL` à chaque appel et recrée l'adaptateur si la valeur change ; sans URL, renvoie un `Exporter` dont les trois méthodes rejettent `new ExportError("UNAVAILABLE", "RENDERER_URL n'est pas défini : le service de rendu est injoignable.")`. `test-setup.ts` ajoute `beforeEach(() => { fakeExporter.reset(); overrideExporter(fakeExporter); })` (le test de `renderer.ts` appelle lui-même `overrideExporter(null)`).

- [ ] **Step 6: Lancer, vérifier le succès**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/renderer.test.ts --coverage.enabled --coverage.include=src/lib/renderer.ts`
Expected: PASS, 100 % sur `renderer.ts`.

- [ ] **Step 7: `next.config.ts`**

`serverExternalPackages: ["@tigamadou/pdf-engine"]` (remplace `@react-pdf/renderer`) ; `outputFileTracingIncludes: { "/**": ["./node_modules/@tigamadou/pdf-engine/fonts/**"] }` (les TTF lus par `montserratFaces()`).

- [ ] **Step 8: Service `renderer` en dev (accord utilisateur obtenu et noté dans `## Progression`)**

Dans `docker-compose.dev.yml` :

```yaml
  renderer:
    image: ghcr.io/tigamadou/pdf-engine-renderer:2.0.0
    # Image publiee en linux/amd64 seulement : emulee (Rosetta) sur Mac Apple Silicon.
    platform: linux/amd64
    init: true
    stop_grace_period: 30s
    restart: unless-stopped
    networks: [rendu]
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 5s
      timeout: 5s
      retries: 10
```

`app.environment` ajoute `RENDERER_URL: http://renderer:3000` ; `app.depends_on` ajoute `renderer: { condition: service_healthy }` ; `app.networks` ajoute `rendu` (en plus de `default`). Déclarer le réseau : `networks: { rendu: { internal: true } }`. Le `healthcheck` ci-dessus reprend celui de l'image : le conserver, ou le retirer pour hériter du `HEALTHCHECK` de l'image si l'accord le permet.

Run: `docker login ghcr.io` (si besoin, jeton `read:packages`) puis `docker compose -f docker-compose.dev.yml up -d renderer app && docker compose -f docker-compose.dev.yml exec app node -e "fetch(process.env.RENDERER_URL+'/health').then(r=>console.log(r.status))"`
Expected: `200`. Sans `platform: linux/amd64`, le pull échoue sur un Mac Apple Silicon (`no matching manifest for linux/arm64`). Sous émulation, le premier rendu est plus lent : `RENDERER_TIMEOUT_MS = 30_000` reste suffisant.

- [ ] **Step 9: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add package.json yarn.lock next.config.ts docker-compose.dev.yml src/lib/renderer.ts src/lib/__tests__/renderer.test.ts src/lib/__tests__/helpers/fake-exporter.ts src/test-setup.ts
/usr/bin/git commit -m "feat(badges): moteur 2.0.0, exporteur du service de rendu et service renderer de dev"
```

### Task 2: Lecture des layouts au format 3 et résolution sans `@react-pdf`

**Files:**
- Modify: `src/lib/badge-templates/resolve.ts`, `src/lib/badge-templates/types.ts`
- Modify: `prisma/badge-templates/default/manifest.json`, `prisma/badge-templates/recto-verso/manifest.json` (format 3)
- Rename + Modify: `src/lib/badge-templates/__tests__/resolve.test.tsx` → `resolve.test.ts`
- Modify: `src/lib/badge-templates/__tests__/reference-packages.test.ts`, `event-template-variables.test.ts`, `src/app/api/platform/badge-templates/**/__tests__/*.test.ts` (fixtures `formatVersion: 3`)

**Interfaces:**
- Consumes: `migrateManifest` (racine du moteur, importé sous le nom `migrateToV3` pour ne pas masquer `migrate-v1.ts`), `AssetResolver`, `TemplateManifest`.
- Produces:

```ts
// resolve.ts
export const CURRENT_FORMAT = 3;
// 3 : tel quel ; 2 : migré en mémoire (`migrateToV3(layout) as TemplateManifest` — le layout a été
// validé à l'installation, la migration n'est qu'une renumérotation) ; autre : Error dont le
// message contient `format v<N>` et `make migrate-installed-templates`.
export function readLayout(row: Pick<InstalledBadgeTemplate, "id" | "formatVersion" | "layout">): TemplateManifest;
export async function resolveTemplate(id: string): Promise<BadgeTemplate>; // inchangée
// types.ts
export type BadgeTemplate = {
  meta: TemplateMeta;            // id = row.id, version = row.version, pages, pageSize "<n>px", label, description, previewSrc
  manifest: TemplateManifest;    // format 3
  variables: VariableDeclaration[];
  bindings: Bindings;
  assets: AssetResolver;         // data URL des ressources préchargées
};
```

`Component` disparaît de `BadgeTemplate`, ainsi que l'import de `ComponentType`.

- [ ] **Step 1: Migrer les deux paquets livrés**

Run: `docker compose -f docker-compose.dev.yml exec app yarn tsx -e "import {migrateManifest} from '@tigamadou/pdf-engine'; import fs from 'node:fs'; for (const f of ['default','recto-verso']) { const p='prisma/badge-templates/'+f+'/manifest.json'; fs.writeFileSync(p, JSON.stringify(migrateManifest(JSON.parse(fs.readFileSync(p,'utf8'))), null, 2)+'\n'); }"`
Expected: `git diff --stat prisma/badge-templates` ne montre que `formatVersion` passé à 3 (renumérotation seule, spec « Format 3 »).

- [ ] **Step 2: Écrire les tests qui échouent dans `resolve.test.ts`**

Réécrire les cas qui utilisaient `renderToJson` sur `t.Component` : ils vérifient désormais `t.assets("<nom>")` (data URL `data:image/png;base64,…`) et `renderHtml(t.manifest, { values: {}, assets: t.assets, defaultFont: montserratFaces() }).html` contient cette data URL. Ajouter :
- `readLayout` d'une ligne `formatVersion: 3` renvoie le layout tel quel (même référence d'objet).
- `readLayout` d'une ligne `formatVersion: 2` renvoie un manifeste `formatVersion: 3` aux blocs identiques.
- `readLayout` d'une ligne `formatVersion: 1` lève un message contenant `format v1` et `make migrate-installed-templates`.
- `resolveTemplate` d'une ligne restée au format 2 réussit et `t.manifest.formatVersion === 3`.
- `referencedAssets` d'un manifeste dont un `rect` n'a pas de propriété `image` (fond uni seulement) renvoie `[]` pour ce bloc, sans erreur ; le même manifeste avec un `rect` à `image.asset: "assets/fond.png"` renvoie `["assets/fond.png"]`.
- Formes vectorielles (livrées dans la 2.0.0) : une `ellipse` à `image.asset: "assets/motif.png"` renvoie `["assets/motif.png"]`, y compris dans un `group` ; une `line`, un `polygon` et un `path` (sans propriété `image`) renvoient `[]`, sans erreur. Le manifeste de test est validé par `parseManifest` du moteur.
- `t.meta` vaut `{ id: row.id, version: row.version, label, description, pages, pageSize: { width: "320px", height: "460px" }, previewSrc }` pour une ligne 320 × 460.
Passer toutes les fixtures de ligne créées par les tests de ce module et des routes `platform/badge-templates` à `formatVersion: 3` (sauf le cas « format 2 migré en mémoire »).

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/resolve.test.ts`
Expected: FAIL (`readLayout` absent, `buildDeclarativeTemplate` introuvable dans le moteur).

- [ ] **Step 4: Implémenter**

`buildFromRow` : `readLayout` remplace la garde `formatVersion !== 2` ; plus d'appel à `buildDeclarativeTemplate` ; `meta` construit depuis la ligne ; `loadAssetResolver` reçoit le manifeste lu (et non `row.layout`). `blockAssets` couvre les formes vectorielles, livrées dans la 2.0.0 : il ne lit `b.image?.asset` que si `"image" in b` (cas de `rect`, `square`, `circle` et `ellipse`), sinon il renvoie `[]` pour ce bloc (`line`, `polygon`, `path`). Pas de `switch` exhaustif sur le type : un type sans `image` ne référence aucune ressource.

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/resolve.test.ts src/lib/badge-templates/__tests__/reference-packages.test.ts src/lib/badge-templates/__tests__/event-template-variables.test.ts`
Expected: PASS.

- [ ] **Step 6: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add prisma/badge-templates src/lib/badge-templates/resolve.ts src/lib/badge-templates/types.ts src/lib/badge-templates/__tests__ src/app/api/platform/badge-templates
/usr/bin/git commit -m "feat(badges): layouts au format 3, migration en memoire du format 2 et resolution sans react-pdf"
```

### Task 3: Rendu d'un badge en HTML, document figé et PDF

**Files:**
- Delete: `src/lib/badge-templates/render-badge.tsx` ; Create: `src/lib/badge-templates/render-badge.ts`
- Modify: `src/lib/badge-templates/__tests__/render-badge.test.ts`

**Interfaces:**
- Consumes: `resolveEventTemplate`, `buildTemplateContext`, `buildValues` (existants), `renderHtml` (`/html`), `montserratFaces` (`/fonts`), `RENDERER_MAX_BODY_BYTES` (`/export`), `getExporter` (tâche 1).
- Produces:

```ts
export const badgeRegistrationInclude; export type BadgeRegistration;        // inchangés
export async function loadBadgeRegistration(id: string): Promise<BadgeRegistration | null>; // inchangée
export async function resolveEventTemplate(event: { badgeTemplateId: string | null; orgId: string }): Promise<BadgeTemplate>;
// Marge de 64 Kio sous la limite du service pour l'enveloppe JSON.
export const MAX_DOCUMENT_BYTES = RENDERER_MAX_BODY_BYTES - 64 * 1024;
// Document vivant ; lève Error("document du badge trop volumineux (<x> Mo, limite 20 Mo) : réduire la photo, le logo ou la bannière")
// si Buffer.byteLength(JSON.stringify({ document })) > MAX_DOCUMENT_BYTES.
export async function renderBadgeDocument(registration: BadgeRegistration): Promise<{ document: HtmlDocument; templateId: string }>;
export async function renderBadgeHtml(registration: BadgeRegistration): Promise<{ document: HtmlDocument; templateId: string }>; // getExporter().freeze
export async function renderBadgePdf(registration: BadgeRegistration): Promise<{ pdf: Uint8Array; templateId: string }>;      // getExporter().pdf(document vivant)
```

- [ ] **Step 1: Écrire les tests qui échouent**

Conserver les cas de résolution (repli organisation, famille `default`, sans `PlatformSettings`) en les appliquant à `renderBadgeDocument`. Ajouter :
- `renderBadgeDocument` (famille `default`) : `document.frozen === false`, `document.pages` vaut `[1]`, `document.html` commence par `<!doctype html>` et contient le prénom et le nom du participant (comparés sur `document.html.replaceAll("⁠", "")` ; la fixture porte un nom composé, ex. « Anne-Marie », pour couvrir le cas) ; `fakeExporter.calls` est vide (le rendu vivant n'appelle pas le service).
- Template recto-verso : `document.pages` vaut `[1, 2]`.
- `renderBadgeHtml` : `document.frozen === true`, ne contient ni `<script` ni U+2060, un seul appel `freeze`.
- `renderBadgePdf` : commence par `%PDF-`, `countPdfPages(pdf) === 1`, un seul appel `pdf` dont `doc.frozen === false`.
- `fakeExporter.failNext("UNAVAILABLE")` : `renderBadgePdf` rejette une `ExportError` de code `UNAVAILABLE`.
- Badge trop lourd : photo d'inscription de 21 Mo (data URL factice) → `renderBadgeDocument` rejette avec un message contenant `trop volumineux`, aucun appel au service.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/render-badge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `render-badge.ts`**

Même construction du contexte qu'aujourd'hui, puis `renderHtml(template.manifest, { values, assets: template.assets, defaultFont: montserratFaces() })`. Aucun import de `react`.

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/render-badge.test.ts`
Expected: PASS.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/lib/badge-templates/render-badge.ts src/lib/badge-templates/render-badge.tsx src/lib/badge-templates/__tests__/render-badge.test.ts
/usr/bin/git commit -m "feat(badges): rendu d'un badge en HTML, document fige et PDF par le service"
```

### Task 4: Épreuve `proof.png` à l'installation

**Files:**
- Modify: `src/lib/badge-templates/install.ts`, `src/lib/badge-templates/__tests__/install.test.ts`
- Modify: `src/app/api/platform/badge-templates/route.ts` et son test

**Interfaces:**
- Consumes: `renderProof(manifest, assets, templateId, exporter)` (voir « Interfaces du moteur 2.0.0 »), `getExporter`, `isRendererUnavailable`, `rendererUnavailableResponse` (tâche 1).
- Produces:

```ts
export const PROOF_FILE = "proof.png";
// Vrai pour les fichiers produits par l'application, pas par le paquet :
// proof.pdf, proof.png, proof-engine-<version>.pdf|png, à la racine du préfixe.
export function isGeneratedProofKey(key: string): boolean;
export async function installTemplate(args: { manifest; assets; bindings; installedById }): Promise<InstallResult>; // signature inchangée
```

- [ ] **Step 1: Écrire les tests qui échouent**

`install.test.ts` : `row.proofPath === \`badge-templates/${row.id}/proof.png\`` ; le fichier stocké commence par la signature PNG (`89 50 4E 47`) et a le type `image/png` ; un appel `image` au faux exporteur avec `opts.page === 1` ; `fakeExporter.failNext("UNAVAILABLE")` → `installTemplate` rejette une `ExportError` `UNAVAILABLE`, aucune ligne créée, aucun objet sous le préfixe. `isGeneratedProofKey` : vrai pour `badge-templates/x/proof.pdf`, `…/proof.png`, `…/proof-engine-2.0.0.png`, `…/proof-engine-1.2.0.pdf` ; faux pour `…/assets/proof.png` et `…/preview.png`.
Route `POST /api/platform/badge-templates` : `proofPath` se termine par `/proof.png` ; avec `failNext("UNAVAILABLE")`, statut **503**, corps `{ error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE }`, aucune activité `BADGE_TEMPLATE_INSTALLED` ; avec `failNext("RENDER_FAILED")`, 400 `INVALID_PACKAGE` comme aujourd'hui.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/install.test.ts src/app/api/platform/badge-templates/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`installTemplate` : `const { png } = await renderProof(manifest, assets, id, getExporter())`, upload `${assetPrefix}proof.png` en `image/png`. La route teste `isRendererUnavailable(err)` avant de traduire en 400.

- [ ] **Step 4: Lancer, vérifier le succès**

Même commande. Expected: PASS.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/lib/badge-templates/install.ts src/lib/badge-templates/__tests__/install.test.ts src/app/api/platform/badge-templates
/usr/bin/git commit -m "feat(badges): epreuve PNG a l'installation et 503 si le service de rendu manque"
```

### Task 5: Routes du badge (`PDF`, `?format=html`) et du ZIP

**Files:**
- Delete: `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx` ; Create: `…/[badgeId]/route.ts`
- Modify: `…/[badgeId]/__tests__/route.test.ts`
- Modify: `…/badges/print-zip/route.ts`, `…/print-zip/__tests__/route.test.ts`
- Modify: `src/lib/badge-batch.ts`, `src/lib/__tests__/badge-batch.test.ts` (créé s'il n'existe pas)
- Modify: les tests de ces deux routes (retrait de `vi.mock("@react-pdf/renderer")` et d'`extractPdfText`)

**Interfaces:**
- Consumes: `renderBadgeHtml`, `renderBadgePdf`, `loadBadgeRegistration` (tâche 3), `isRendererUnavailable`, `rendererUnavailableResponse` (tâche 1).
- Produces:

```
GET …/badges/[badgeId]                 -> application/pdf (inline ; attachment si ?download=1), x-template-id
GET …/badges/[badgeId]?format=html     -> 200 JSON HtmlDocument figé, cache-control: private, no-store, x-template-id
  service indisponible / trop lent     -> 503 { error: "RENDERER_UNAVAILABLE", message }
  autre échec de rendu                 -> 500 { error: "RENDER_FAILED", id }
  ?format=<autre que html>             -> 400 { error: "VALIDATION" }
GET …/badges/print-zip?ids=…           -> ZIP d'un PDF par badge (ordre des ids) ; 503 si le service manque
```

```ts
// badge-batch.ts
export const BATCH_RENDER_CONCURRENCY = 4;
// Applique fn avec au plus `limit` appels simultanés ; résultats dans l'ordre d'entrée ;
// rejette avec la première erreur, sans lancer de nouvel appel après elle.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>;
```

- [ ] **Step 1: Écrire les tests qui échouent**

Route du badge (même garde `badge.print`, mêmes cas 401/403/404 qu'aujourd'hui) :
- PDF par défaut : 200, `application/pdf`, `%PDF-`, 1 page (`countPdfPages`) pour `default`, 2 pour recto-verso, `content-disposition` `inline` puis `attachment` avec `?download=1`.
- `?format=html` : 200, `content-type` JSON, `cache-control: private, no-store`, corps `frozen: true`, `pages` `[1]`, `html` sans `<script`, `x-template-id` égal au template effectif.
- Les tests de contenu « consignes / ALL ACCESS » et « options du badge » passent par `?format=html` et vérifient `document.html` (`toContain("ALL ACCESS")`, `toContain("Restez dans la zone indiquee.")`, `not.toContain("BANDEAU")` après coupure de l'interrupteur) ; leurs layouts passent à `formatVersion: 3`.
- `failNext("UNAVAILABLE")` puis `failNext("TIMEOUT")` : 503 avec `RENDERER_UNAVAILABLE_MESSAGE`, pour le PDF comme pour le HTML.
- `failNext("RENDER_FAILED")` : 500 `RENDER_FAILED` avec l'id.
- `?format=png` : 400 `VALIDATION`.
ZIP : 3 badges → 3 entrées dans l'ordre des ids, chacune `%PDF-` ; `failNext("UNAVAILABLE")` → 503 ; `failNext("RENDER_FAILED")` → 500 avec l'id. `mapWithConcurrency` : ordre conservé avec des délais inversés, jamais plus de 2 appels simultanés pour `limit = 2` (compteur), rejet sur la première erreur et aucun appel lancé après.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run "src/app/api/org/[orgId]/events/[eventId]/badges" src/lib/__tests__/badge-batch.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter les deux routes et `mapWithConcurrency`**

Le ZIP rend les PDF par `mapWithConcurrency(registrations, BATCH_RENDER_CONCURRENCY, …)` ; la fonction passée enrichit l'erreur de l'id de l'inscription pour la réponse 500.

- [ ] **Step 4: Lancer, vérifier le succès, re-seeder**

Run: la commande du Step 2, puis `docker compose -f docker-compose.dev.yml exec app yarn prisma db seed`
Expected: PASS ; le seed installe `default` et `recto-verso` avec `proof.png` par le vrai service.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/app/api/org src/lib/badge-batch.ts src/lib/__tests__/badge-batch.test.ts
/usr/bin/git commit -m "feat(badges): routes du badge et du lot rendues par le service, document fige en JSON"
```

### Task 6: `verify-engine`, export du corpus et validation au format 3

**Files:**
- Modify: `src/lib/badge-templates/engine-upgrade.ts`, `src/lib/badge-templates/__tests__/engine-upgrade.test.ts`
- Modify: `src/lib/badge-templates/engine-corpus.ts`, `src/lib/badge-templates/__tests__/engine-corpus.test.ts`
- Modify: `scripts/validate-badge-templates.ts`, `scripts/verify-engine-upgrade.ts`
- Modify: `Makefile` (commentaires de `verify-engine*` : épreuves `.png`)

**Interfaces:**
- Consumes: `readLayout` (tâche 2), `htmlFingerprint`, `renderProof`, `renderHtml`, `montserratFaces`, `getExporter`.
- Produces:

```ts
export type Baseline = { engineVersion: string; checkedAt: string; fingerprint: "html"; templates: Record<string, Record<string, string>> };
// Empreinte = htmlFingerprint(renderHtml(manifeste lu, variante)) : document vivant, sans appel au service.
export async function checkTemplate(row: InstalledBadgeTemplate): Promise<TemplateCheck>;
// Épreuve : `${assetPrefix}proof-engine-${ENGINE_VERSION}.png` (renderProof(...).png, image/png).
// Une référence sans `fingerprint: "html"` (moteur 1.x) est « d'un autre moteur » : chaque
// template est rapporté `fresh` avec son épreuve régénérée.
export async function verifyEngineUpgrade(options: { accept: boolean }): Promise<UpgradeReport>;
export async function exportEngineCorpus(outDir: string): Promise<string[]>; // écrit des manifestes format 3 (lignes 2 migrées en mémoire), ignore le format 1
```

- [ ] **Step 1: Écrire les tests qui échouent**

`engine-upgrade.test.ts` : épreuves `proof-engine-<ENGINE_VERSION>.png` à signature PNG ; une ligne au format 2 est vérifiée (statut `ok`, pas `refused`) ; une ligne au format 1 est `refused` avec `make migrate-installed-templates` ; deux appels successifs à `checkTemplate` donnent les mêmes empreintes et n'appellent pas le service ; une référence enregistrée sans `fingerprint` (simuler la 1.2.0) → tous `fresh` avec `proofPath` ; `--accept` écrit `fingerprint: "html"` ; `failNext("UNAVAILABLE")` pendant l'écriture d'une épreuve → `verifyEngineUpgrade` rejette une `ExportError`. Mettre à jour les attendus de `formatReport` (`.png`).
`engine-corpus.test.ts` : une ligne au format 2 est exportée avec `"formatVersion": 3`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/engine-upgrade.test.ts src/lib/badge-templates/__tests__/engine-corpus.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`validate-badge-templates.ts` : une ligne `formatVersion !== 3` est une anomalie « encore au format vN (make migrate-installed-templates) » ; la lecture des variables passe par `readLayout`.

- [ ] **Step 4: Vérifier**

Run: même commande, puis `docker compose -f docker-compose.dev.yml exec app yarn prisma db seed && make verify-engine && make validate-badge-templates`
Expected: PASS ; `verify-engine` liste les deux templates livrés, épreuves `.png` dans RustFS ; `validate-badge-templates` répond `OK`.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/lib/badge-templates scripts/validate-badge-templates.ts scripts/verify-engine-upgrade.ts Makefile
/usr/bin/git commit -m "feat(badges): verify-engine par empreinte HTML et epreuves PNG, corpus au format 3"
```

### Task 7: Script de migration des templates installés vers le format 3

**Files:**
- Create: `scripts/migrate-installed-templates-v3.ts`, `scripts/__tests__/migrate-installed-templates-v3.test.ts`
- Delete: `scripts/migrate-installed-templates-v2.ts`, `scripts/__tests__/migrate-installed-templates-v2.test.ts` (son traitement du format 1 est repris par le v3 ; le moteur 2.0.0 refuse le format 2 qu'il produisait)
- Modify: `Makefile`, `prisma/schema.prisma` (commentaires de `bindings` et `proofPath` seulement)

**Interfaces:**
- Consumes: `migrateManifest` et `V1_VARIABLES` de `src/lib/badge-templates/migrate-v1.ts` (1→2), `migrateToV3` (2→3, renvoie `unknown` : toujours suivi de `parseManifest`), `parseManifest`, `validateBindings`, `assetNamesFor`, `renderProof`, `getExporter`, `listPrefix`, `getFile`, `uploadFile`.
- Produces:

```ts
export type MigrationV3Report = {
  migrated: Array<{ id: string; from: 1 | 2; proofPath: string }>;
  skipped: Array<{ id: string; reason: string }>;
  applied: boolean;
};
// Lignes formatVersion < 3, archivées comprises. Phase 1, par ligne : 1→2 si besoin (liaisons
// identité), 2→3, parseManifest, validateBindings, ressources, renderProof ; avec apply, upload
// de `<prefixe>proof.png` (clé nouvelle : proof.pdf reste en place). Phase 2, seulement si apply
// et aucune ligne sautée : UNE prisma.$transaction qui écrit layout, bindings (lignes v1),
// formatVersion 3 et proofPath. Une ligne sautée => aucune écriture en base, applied = false.
export async function migrateInstalledTemplatesV3(options: { apply: boolean }): Promise<MigrationV3Report>;
```

CLI : `--apply` pour écrire, dry-run sinon ; code de sortie 1 si une ligne est sautée.

- [ ] **Step 1: Écrire les tests qui échouent**

- Dry-run sur une ligne au format 2 : `migrated` la contient, `applied === false`, la ligne est inchangée en base, aucun `proof.png` stocké, un appel `image` au faux exporteur (le rendu est validé même en dry-run).
- `apply` : `formatVersion === 3`, `layout.formatVersion === 3`, `proofPath === \`${assetPrefix}proof.png\``, l'objet stocké commence par la signature PNG, `proof.pdf` toujours présent.
- Ligne au format 1 : migrée en chaîne, `from === 1`, liaisons identité écrites.
- Ligne archivée : migrée.
- Deux lignes dont une au layout corrompu, `apply` : la corrompue est dans `skipped` (raison préfixée `validation :`), **aucune** des deux n'est écrite en base, `applied === false`.
- `failNext("UNAVAILABLE")` : la ligne est sautée avec une raison contenant `service de rendu`.
- Second passage après `apply` : `migrated` et `skipped` vides.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run scripts/__tests__/migrate-installed-templates-v3.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter le script et les cibles make**

Sur le modèle de `verify-engine*` :

```make
migrate-installed-templates:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/migrate-installed-templates-v3.ts $(ARGS)
migrate-installed-templates-preprod:
	$(SSH) $(SERVER) "cd $(PREPROD_DIR) && export BADGE_TAG=$(or $(TAG),preprod) && $(PREPROD_COMPOSE) --profile tools pull tools && $(PREPROD_COMPOSE) --profile tools run --rm tools yarn tsx scripts/migrate-installed-templates-v3.ts $(ARGS)"
migrate-installed-templates-prod:
	$(SSH) $(SERVER) "cd $(PROD_DIR) && export BADGE_TAG=$(or $(TAG),prod) && docker compose --profile tools pull tools && docker compose --profile tools run --rm tools yarn tsx scripts/migrate-installed-templates-v3.ts $(ARGS)"
```

Ajouter de même `validate-badge-templates-preprod` et `validate-badge-templates-prod` (même patron, `scripts/validate-badge-templates.ts`) et les déclarer dans `.PHONY`.

- [ ] **Step 4: Vérifier, puis rendre la suite entière verte (fin de la bascule)**

Run: le test ci-dessus ; `grep -rln "react-pdf\|extractPdfText\|renderToJson\|formatVersion: 2" src scripts` ne doit plus lister que les tests qui exercent volontairement le format 2 ; puis `docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage && make lint && make typecheck`, puis `… exec app yarn prisma db seed && make migrate-installed-templates` (dry-run sur la base seedée).
Expected: PASS, couverture 100 % ; « DRY-RUN … migres : 0 », sortie 0.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add scripts Makefile prisma/schema.prisma
/usr/bin/git commit -m "feat(badges): migration des templates installes vers le format 3 avec epreuve PNG"
```

### Task 8: Service `renderer` en production, préproduction et CI

**Files (accord utilisateur requis avant modification) :**
- Modify: `docker-compose.yml`, `docker-compose.preprod.yml`, `deploy.sh`, `.env.production.example`
- Modify: `.github/workflows/ci.yml` (job `e2e`)
- Create: `src/lib/__tests__/renderer-version.test.ts`

**Interfaces:**
- Consumes: `ENGINE_VERSION` (`engine-upgrade.ts`).
- Produces: service `renderer` (conteneur `badge-renderer` / `badge-renderer-preprod`), `RENDERER_URL=http://badge-renderer:3000` (prod) / `http://badge-renderer-preprod:3000` (preprod), posé dans `environment:` de `app`, `tools` et `init` (aucune modification manuelle des `.env` du serveur).

- [ ] **Step 1: Écrire le test qui échoue** — `renderer-version.test.ts`

Pour `docker-compose.dev.yml`, `docker-compose.yml`, `docker-compose.preprod.yml` (lus comme texte) : chacun contient exactement une fois `ghcr.io/tigamadou/pdf-engine-renderer:${ENGINE_VERSION}`, aucune autre occurrence de `pdf-engine-renderer:`, et aucun bloc `ports:` dans le service `renderer` (hors CI), `init: true`, `stop_grace_period: 30s` (extraire le bloc entre `  renderer:` et le service suivant) ; le bloc `renderer` de `docker-compose.dev.yml` porte `platform: linux/amd64` (image sans variante arm64, voir la tâche 1). `package.json` déclare `@tigamadou/pdf-engine` à `ENGINE_VERSION` sans `^` ni `~`. Le job `e2e` de `ci.yml` référence la même image.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/renderer-version.test.ts`
Expected: FAIL (prod et preprod sans service `renderer`).

- [ ] **Step 3: Écrire les services et le déploiement**

Prod et preprod : bloc de la tâche 1 avec `container_name`, `restart: unless-stopped`, `expose: ["3000"]`, réseau `rendu` seulement (`internal: true`, jamais `web` ni `default`), `init: true`, `stop_grace_period: 30s` ; `app` et `tools` rejoignent le réseau `rendu` (en plus de leurs réseaux actuels) et dépendent de `renderer` (`service_healthy`). Le test de la tâche vérifie aussi `init: true`, `stop_grace_period: 30s` et le réseau interne. `deploy.sh` : `docker compose $F pull renderer app tools` puis `docker compose $F up -d --no-deps renderer init app`. `.env.production.example` : section commentée « Service de rendu » qui indique que `RENDERER_URL` est posé par le compose. CI, job `e2e` :

```yaml
      renderer:
        image: ghcr.io/tigamadou/pdf-engine-renderer:2.0.0
        credentials:
          username: ${{ github.actor }}
          password: ${{ secrets.NPM_TOKEN }}
        ports:
          - 3100:3000
```

et `RENDERER_URL: http://127.0.0.1:3100` dans l'`env` du job (le seed et l'application en ont besoin). Le job `unit-integration` n'en a pas besoin (faux exporteur).

- [ ] **Step 4: Vérifier**

Run: le test ci-dessus, puis `docker compose -f docker-compose.yml config -q && docker compose -f docker-compose.preprod.yml config -q && sh -n deploy.sh`
Expected: PASS, aucune sortie d'erreur.

- [ ] **Step 5: Progression (accord utilisateur noté), cocher, commiter (sur demande)**

```bash
/usr/bin/git add docker-compose.yml docker-compose.preprod.yml deploy.sh .env.production.example .github/workflows/ci.yml src/lib/__tests__/renderer-version.test.ts
/usr/bin/git commit -m "chore(badges): service renderer en prod, preprod et CI, version egale au moteur"
```

### Task 9: `BadgeDocumentView` et les écrans d'impression

**Files:**
- Create: `src/types/page-view.d.ts`
- Create: `src/lib/badge-document-client.ts`, `src/lib/__tests__/badge-document-client.test.ts`
- Create: `src/components/badge/BadgeDocumentView.tsx`, `src/components/badge/__tests__/BadgeDocumentView.test.tsx`
- Modify: `src/components/badge/BadgePrintActions.tsx`, `src/components/event/BadgeBatchPanel.tsx` et leurs tests

**Interfaces:**
- Consumes: `definePageView`, `PageViewElement`, `PageViewLayout`, `PageViewFit` (`@tigamadou/pdf-engine/viewer`), `HtmlDocument`, route `?format=html` (tâche 5).
- Produces:

```ts
// src/types/page-view.d.ts : déclare l'élément pour TypeScript (React 19)
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "page-view": React.DetailedHTMLProps<React.HTMLAttributes<PageViewElement>, PageViewElement> & {
        page?: number | string; layout?: PageViewLayout; fit?: PageViewFit;
        "min-zoom"?: number | string; "max-zoom"?: number | string; label?: string;
      };
    }
  }
}

// src/lib/badge-document-client.ts (isomorphe, sans React)
export const PREVIEW_UNAVAILABLE = "Aperçu indisponible, réessayer";
export function badgeDocumentUrl(orgId: string, eventId: string, badgeId: string): string; // …/badges/<id>?format=html
export type BadgeDocumentResult = { ok: true; document: HtmlDocument } | { ok: false; message: string };
// 200 + JSON { html: string, frozen: true, pages: number[] } => ok ; tout le reste (statut, réseau,
// JSON illisible, document non figé, abandon) => { ok: false, message } ; message = body.message
// pour un 503, PREVIEW_UNAVAILABLE sinon. Ne rejette jamais.
export async function fetchBadgeDocument(url: string, init?: { signal?: AbortSignal; fetch?: typeof fetch }): Promise<BadgeDocumentResult>;

// src/components/badge/BadgeDocumentView.tsx ("use client")
export function BadgeDocumentView(props: { src: string; label: string; className?: string }): JSX.Element;
```

Règle de confiance : `fetchBadgeDocument` refuse tout document non figé (`ok: false`), et la route `?format=html` ne renvoie que `freeze` ; `BadgeDocumentView` ne reçoit donc jamais de document vivant. Comportement de `BadgeDocumentView` : un `useEffect` dépendant de `[src, attempt]` passe l'état à `loading`, appelle `fetchBadgeDocument(src, { signal })`, puis `const { definePageView } = await import("@tigamadou/pdf-engine/viewer"); definePageView();` et pose `ref.current.document = result.document` **par la ref** (avant l'enregistrement de l'élément, React écrirait un attribut texte au lieu de la propriété) ; le nettoyage de l'effet abandonne la requête et ignore toute réponse périmée. Rendu : un conteneur `data-testid="badge-document"`, `data-state="loading|ready|error"`, `data-requested-src={src}`, `data-src={src du document affiché, "" sinon}`, contenant toujours `<page-view ref label={label} layout="all" fit="width" className="block h-full w-full">`, un calque « Chargement de l'aperçu… » en `loading`, et en `error` un `<button>` dont le texte est `PREVIEW_UNAVAILABLE` (incrémente `attempt`) précédé du message reçu s'il diffère. L'état passe à `ready` sur l'événement `pe-ready` de l'élément (`PAGE_VIEW_EVENTS.ready`). Hauteur du conteneur, **obligatoire** (`<page-view>` prend `height: 100%`, minimum 160 px) : `h-[70vh] max-h-[640px] w-full`.

- [ ] **Step 1: Écrire les tests qui échouent**

`badge-document-client.test.ts` (faux `fetch`) : `badgeDocumentUrl("o1","e1","111")` vaut `/api/org/o1/events/e1/badges/111?format=html` ; 200 figé → `ok: true` avec le document ; 200 avec `frozen: false` → `ok: false` ; 503 `{ message: "X" }` → `{ ok: false, message: "X" }` ; 500 → `PREVIEW_UNAVAILABLE` ; JSON illisible → `PREVIEW_UNAVAILABLE` ; `fetch` qui rejette (réseau, `AbortError`) → `ok: false`, sans rejet.
`BadgeDocumentView.test.tsx` (`renderToStaticMarkup`) : contient `<page-view`, `label="Aperçu du badge"`, `data-state="loading"`, `data-requested-src="/api/…?format=html"`, « Chargement de l'aperçu… », la classe `h-[70vh]` sur le conteneur, et ni `<iframe` ni `<object`.
`BadgePrintActions.test.tsx` : plus d'`<iframe` ; contient `<page-view` ; lien « Télécharger » `href="…/badges/r1?download=1"` ; lien « Imprimer » `href="…/badges/r1"`, `target="_blank"`, `rel="noopener noreferrer"` ; cas « non approuvé » et « archivé » inchangés.
`BadgeBatchPanel.test.tsx` : `data-requested-src="/api/org/o1/events/e1/badges/111?format=html"` remplace l'attente sur `src=` ; l'état vide ne contient pas `<page-view`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/badge-document-client.test.ts src/components/badge src/components/event/__tests__/BadgeBatchPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter les cinq fichiers**

- [ ] **Step 4: Vérifier**

Run: la commande ci-dessus, puis `make typecheck && make lint`
Expected: PASS ; aucun `any` ni `@ts-expect-error` pour `page-view`.

- [ ] **Step 5: Vérification manuelle**

`https://badge.local` → page d'un badge : l'aperçu s'affiche, le pincement et Ctrl + molette zooment, « Imprimer » ouvre le PDF dans un nouvel onglet ; `docker compose -f docker-compose.dev.yml stop renderer` → « Aperçu indisponible, réessayer » ; `start renderer`, clic → l'aperçu revient. Noter le résultat dans les notes de la tâche 9.

- [ ] **Step 6: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/types/page-view.d.ts src/lib/badge-document-client.ts src/lib/__tests__/badge-document-client.test.ts src/components/badge src/components/event
/usr/bin/git commit -m "feat(badges): apercu page-view du document fige, boutons Telecharger et Imprimer"
```

### Task 10: Épreuve PNG au catalogue et sur la page de détail

**Files:**
- Modify: `src/components/ui/TemplatePreview.tsx`
- Modify: `src/lib/badge-templates/resolve.ts` (`templateImageUrl`), `…/__tests__/resolve.test.ts`
- Modify: `src/app/platform/badge-templates/page.tsx`, `src/app/platform/badge-templates/[id]/page.tsx`
- Create: `src/components/ui/__tests__/TemplatePreview.test.tsx`

**Interfaces:**
- Consumes: `previewUrl`, `isGeneratedProofKey` (tâche 4).
- Produces:

```ts
// Première source affichable comme image (.png, .jpg, .jpeg, .webp), dans l'ordre demandé ;
// "" si aucune. Une épreuve .pdf d'avant la migration est ignorée.
export function templateImageUrl(row: { previewPath: string | null; proofPath: string | null }, prefer: "preview" | "proof"): string;
```

Catalogue, `listAvailableTemplates`, `meta.previewSrc` : `prefer: "preview"` (l'image du paquet, sinon l'épreuve — les deux paquets livrés n'ont pas d'image : leur vignette devient l'épreuve). Page de détail : `prefer: "proof"` ; la liste des ressources filtre `isGeneratedProofKey`. `TemplatePreview` : plus de branche `<object>` ; une source vide ou `.pdf` affiche le repère « Aperçu indisponible ».

- [ ] **Step 1: Écrire les tests qui échouent**

`templateImageUrl` : `{ previewPath: "p/a.png", proofPath: "p/proof.png" }` → `/api/files/p/a.png` (preview) et `/api/files/p/proof.png` (proof) ; `{ previewPath: null, proofPath: "p/proof.png" }`, preview → `/api/files/p/proof.png` ; `{ previewPath: null, proofPath: "p/proof.pdf" }` → `""`. `listAvailableTemplates` d'un template livré seedé : `previewSrc` se termine par `/proof.png`. `TemplatePreview.test.tsx` : une source `.png` rend un `<img` avec `alt="Aperçu X"` ; une source `.pdf` ou vide rend « Aperçu indisponible » et pas d'`<object`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/resolve.test.ts src/components/ui/__tests__/TemplatePreview.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

- [ ] **Step 4: Vérifier**

Même commande, puis `make typecheck`. Expected: PASS.

- [ ] **Step 5: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add src/components/ui src/lib/badge-templates src/app/platform/badge-templates
/usr/bin/git commit -m "feat(badges): epreuve PNG au catalogue et sur la page de detail des templates"
```

### Task 11: Suppression du code mort et de `@react-pdf/renderer`

**Files:**
- Delete: `src/components/badge/{BadgePreview,BadgeDocument,BadgeDocumentAnonymous,BadgeBatchExport,BadgeWebPreview}.tsx` (`BadgeWebPreview` n'est référencé nulle part non plus)
- Delete: `src/lib/image-to-dataurl.ts`, `src/lib/__tests__/image-to-dataurl.test.ts` (seul `BadgeBatchExport` l'utilisait, pour une conversion WebP propre à `@react-pdf`)
- Modify: `src/types/index.ts` (retirer `BadgeProps` / `EventInfo` s'ils ne sont plus importés nulle part)
- Modify: `package.json`, `yarn.lock` (retirer `@react-pdf/renderer`, `file-saver`, `@types/file-saver`)
- Modify: `vitest.config.ts` (retirer l'exclusion `**/template.tsx` et son commentaire)

- [ ] **Step 1: Supprimer et désinstaller**

Run: `docker compose -f docker-compose.dev.yml exec app yarn remove @react-pdf/renderer file-saver @types/file-saver`

- [ ] **Step 2: Vérifier l'absence de références**

Run: `grep -rnE "react-pdf|PDFViewer|renderToBuffer|BadgeDocument|BadgePreview|BadgeBatchExport|BadgeWebPreview|imageUrlToDataUrl|file-saver|buildDeclarativeTemplate|renderToJson|renderTreeFingerprint|extractPdfText" src scripts prisma e2e next.config.ts vitest.config.ts package.json`
Expected: aucune ligne.

- [ ] **Step 3: Suite complète**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage && make lint && make typecheck && make build`, puis `… exec app yarn prisma db seed`
Expected: PASS, 100 %, build sans erreur.

- [ ] **Step 4: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add -A src package.json yarn.lock vitest.config.ts
/usr/bin/git commit -m "chore(badges): retire react-pdf et les composants de badge morts"
```

### Task 12: Parcours E2E, dont la page d'un badge à 375 px

**Files:**
- Modify: `e2e/event/badges.spec.ts`, `e2e/transverse/responsive.spec.ts`, `e2e/platform/badge-templates.spec.ts`, `e2e/event/settings.spec.ts` (layouts `formatVersion: 3`)

Règles du dépôt (`e2e/README.md`) : aucun `page.request.*` nouveau (les deux appels existants de `badges.spec.ts` sont remplacés par des parcours UI), URL vérifiée à chaque navigation, `afterAll` de nettoyage.

- [ ] **Step 1: Écrire les parcours**

`badges.spec.ts` :
- « La page d'un badge montre l'aperçu HTML et marque imprimé » : `[data-testid="badge-document"]` atteint `data-state="ready"` ; `page.frameLocator("page-view iframe").getByText(<prénom>)` visible ; « Télécharger » → `page.waitForEvent("download")`, `suggestedFilename()` se termine par `.pdf` ; « Imprimer » → `page.waitForEvent("popup")`, l'URL du nouvel onglet se termine par `/badges/<id>` ; marquage inchangé.
- « Aperçu indisponible puis réessai » : `page.route("**/badges/*?format=html", r => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "RENDERER_UNAVAILABLE", message: "Le service de rendu des badges est indisponible. Réessayez dans un instant." }) }))` → `data-state="error"` et bouton « Aperçu indisponible, réessayer » visible ; `page.unroute(…)`, clic → `data-state="ready"`.
- « La page de lot » : `data-src` vaut l'URL HTML du premier badge ; avec deux badges approuvés, clic sur le second, puis immédiatement sur le premier, puis sur le second → `data-src` finit égal à l'URL du second et `data-state="ready"` ; le ZIP est téléchargé par clic (`waitForEvent("download")`, nom en `.zip`).
`responsive.spec.ts` (375 × 812, `isMobile`, `hasTouch`) : « Event : la page d'un badge s'affiche sans débordement » — `data-state="ready"`, boîte de `page-view` de largeur ≤ 375 px et > 0, `expectNoHorizontalOverflow(page, "/event/<id>/badges/<regId>")`, « Télécharger » et « Imprimer » visibles dans la fenêtre.
`badge-templates.spec.ts` : `proofPath` se termine par `/proof.png` ; la page de détail montre `img[alt="Aperçu <label>"]` et plus aucun `object[data=…]`.

- [ ] **Step 2: Lancer**

Run: `make test-e2e` (stack de dev démarrée, service `renderer` sain), puis `… exec app yarn prisma db seed`
Expected: toute la suite Playwright PASS.

- [ ] **Step 3: Progression, cocher, commiter (sur demande)**

```bash
/usr/bin/git add e2e
/usr/bin/git commit -m "test(badges): parcours e2e de l'apercu HTML, du reessai et de la page d'un badge a 375 px"
```

### Task 13: Documentation de déploiement et vérification finale

**Files:**
- Modify: `DEPLOYMENT.md` (section « Moteur 2.0.0 : service de rendu »)
- Modify: `docs/v4/features/templates-badges.md` (« Aperçu et épreuve », « Migration d'une base antérieure », « Monter de version le moteur »), `docs/v4/installation.md` (service `renderer` dans la liste des services de dev), `docs/v4/features/politique-tests.md` (faux exporteur, exclusion `template.tsx` retirée)
- Modify: `CLAUDE.md` (ligne « PDF » de la pile : `@tigamadou/pdf-engine` 2 + service de rendu Chromium ; garde-fou « Rendu PDF » : Montserrat embarquée dans le moteur, plus d'accès sortant à Google Fonts requis ; service `renderer` dans le tableau des services), `README.md` si la pile y figure

- [ ] **Step 1: Écrire la procédure de déploiement, dans cet ordre**

1. **Sauvegarde** : `make backup-prod` sur le serveur (dump MySQL) ; noter le chemin. Le S3 n'est modifié que par ajout (`proof.png`) : sa sauvegarde n'est pas requise.
2. **Service de rendu** : recopier `deploy.sh`, `docker-compose.yml` / `docker-compose.preprod.yml` ; `docker login ghcr.io` ; `docker compose pull renderer && docker compose up -d renderer` ; contrôle `docker compose ps renderer` → `healthy`.
3. **Vérification préalable** (sans toucher à `app`) : `make verify-engine-prod TAG=sha-<commit>` — les lignes au format 2 sont migrées en mémoire ; examiner les épreuves `proof-engine-2.0.0.png` (la référence 1.x est « d'un autre moteur » : tous les templates sont « sans référence »).
4. **Déploiement** : publier la release ; `deploy.sh` tire et relance `renderer`, `init`, `app`. Les badges s'impriment aussitôt (migration en mémoire).
5. **Migration** : `make migrate-installed-templates-prod` (dry-run), puis `ARGS=--apply`.
6. **Vérification** : `make validate-badge-templates-prod` → `OK` ; `make verify-engine-prod ARGS=--accept` après examen ; ouvrir la page d'un badge sur un téléphone ; télécharger un ZIP de lot.
Retour arrière : redéployer le tag précédent **et** restaurer le dump (`make rollback-prod SQL=… UPLOADS=…`) — l'application 1.x ne lit pas le format 3. Même procédure en préproduction d'abord (cibles `-preprod`).

- [ ] **Step 2: Vérification finale**

Run, dans cet ordre :
`docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage` ; `make lint` ; `make typecheck` ; `make build` ; `docker compose -f docker-compose.dev.yml exec app sh -c "ls .next/standalone/node_modules/@tigamadou/pdf-engine/fonts/*.ttf"` ; `docker compose -f docker-compose.dev.yml exec app yarn prisma db seed` ; `make test-e2e` ; `docker build --target runner -t badge-verif:local --secret id=npm_token,env=NPM_TOKEN .`
Expected: tout PASS, couverture 100 %, au moins un fichier `.ttf` listé, image `badge-verif:local` construite (jamais `ghcr.io/tigamadou/badge:*`).

- [ ] **Step 3: Progression finale, cocher, commiter, ouvrir la PR (sur demande)**

`## Progression` : toutes les lignes à `[x]`, versions exactes (moteur, image) et résultat de chaque commande ci-dessus dans les notes de la tâche 13. Le `push` et `gh pr create` ne se font que sur demande explicite.

```bash
/usr/bin/git add DEPLOYMENT.md docs CLAUDE.md README.md
/usr/bin/git commit -m "docs(badges): deploiement du moteur 2.0.0 et du service de rendu"
/usr/bin/git push -u origin feat/moteur-html
gh pr create --base development --title "Moteur HTML 2.0.0 et service de rendu" --body "<résumé des 13 tâches, procédure de déploiement de DEPLOYMENT.md>"
```

## Fin du plan

- [ ] Suite Vitest à 100 %, lint, typecheck, build, E2E (dont 375 px) au vert sur `feat/moteur-html`.
- [ ] PR ouverte vers `development` ; aucun commit sur `development`.
- [ ] `## Progression` complète ; prévenir que la procédure de `DEPLOYMENT.md` est prête pour la préproduction, et rappeler que le template ex-305v est à réinstaller depuis le studio (textes de repli d'A7, publiés dans la 2.0.0).
