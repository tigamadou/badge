# Vague 2 · Lot 2a — Images du badge — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2b et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2a feat/retours-client-v3` (le script nomme la branche du lot
> `<base>-2a`, soit `feat/retours-client-v3-2a` ; la base doit exister). Toutes les commandes `make`
> se lancent **dans le worktree** (`../badge-wt-2a`). Sous-skill : `superpowers:subagent-driven-development`
> (ou `superpowers:executing-plans`). En exécution automatisée (tâche planifiée), **un commit par
> tâche est autorisé** sur la branche du lot ; en dehors, aucun commit sans demande explicite, jamais
> de trailer de co-auteur IA, messages en français ASCII (`feat:`, `fix:`, `test:`, `docs:`).

**Objectif :** imposer des dimensions aux images du badge : ratio du cadre du template pour le logo
et la bannière de l'évènement, ratio 7:9 pour la photo du participant ; outil de recadrage unique,
contrôle serveur sur toute entrée, blocage de la génération tant que les images de l'évènement ne
sont pas conformes.

**Architecture :** la conformité est **calculée** (template effectif + dimensions mémorisées), jamais
stockée. Un module pur (`image-frames.ts`, importable côté client) lit les cadres du manifeste et
formule les exigences ; un module serveur (`event-image-compliance.ts`) résout le template effectif,
évalue les images d'un évènement, valide un fichier envoyé et porte l'erreur
`EVENT_IMAGES_NONCOMPLIANT` (422) consommée par les points de génération. Côté interface, un
composant `ImageCropper` (ratio en paramètre) sert logo, bannière et photo.

**Stack :** Next.js 16, React 19, Prisma 6, Vitest 4 (base `badge_2a_test`), Playwright, `react-easy-crop`.

**Spec :** [`specs/2026-11-04-38-v4-retours-client.md`](../specs/2026-11-04-38-v4-retours-client.md), volet 1 et « Organisation du travail ».

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Stack, dépendance, contrats du socle, fabriques du lot | [x] | 2026-11-04 | react-easy-crop 6.2.4 ; JPEG/WebP en-tete seul ; gabarit cadre : variable nommee comme sa source |
| 2 | Cadres du manifeste et exigences (`image-frames.ts`) | [x] | 2026-11-04 | 100 % ; formes square/circle/ellipse lues via w/h |
| 3 | Conformité serveur (`event-image-compliance.ts`) | [x] | 2026-11-04 | 100 % ; test 'aucun template' vide installedBadgeTemplate puis reinstalle les references |
| 4 | Logo / bannière : route d'envoi, PATCH évènement, création | [x] | 2026-11-04 | tests PATCH adaptes (vraies images) ; events/route.ts verifie en couverture globale |
| 5 | Photo du participant : contrôle serveur sur tous les chemins | [x] | 2026-11-04 | helpers checkIdPhotoBuffer/Key et rejectionResponse dans event-image-compliance ; PUT /api/account/profile (pas PATCH) |
| 6 | Blocage : rendu PDF, aperçu, exports, planches | [x] | 2026-11-04 | tests regroupes dans event-images-blocking.test.ts ; worker FAILED OK sans modification |
| 7 | Blocage : soumission de commande, impression sur place | [x] | 2026-11-04 | tests regroupes dans event-images-blocking-requests.test.ts |
| 8 | Composant `ImageCropper` | [ ] | | |
| 9 | Interface évènement : réglages, bandeau, tableau de bord | [ ] | | |
| 10 | Interface photo : compte, inscription, règles de la photo d'identité | [ ] | | |
| 11 | Seed démo et fixtures e2e conformes | [ ] | | |
| 12 | e2e Playwright et contrôle 375 / 1024 / 1280 px | [ ] | | |
| 13 | e2e, doc, vérification | [ ] | | |

## Décisions du lot (à journaliser dans la spec en fin de lot)

- **Plusieurs blocs, ratios différents** (spec [B]) : on retient le **premier bloc en ordre de
  document** (parcours en profondeur, groupes compris) dont l'image est une variable liée à la
  source ; les autres blocs ne sont pas contrôlés. Documenté dans `templates-badges.md`.
- **Variable liée** : le cadre se cherche par **liaison** (`bindings[nom] === "event.logoDataUrl"`),
  pas par le nom de la variable.
- **WebP** : le moteur ne lit pas WebP. Pour `purpose=logo|banner`, WebP est refusé (415
  `UNSUPPORTED_FORMAT`) même si le template n'utilise pas encore la variable ; l'original
  (`purpose=original`, source de recadrage) accepte JPEG/PNG/WebP. Le recadrage produit PNG ou JPEG.
- **Résolution minimale** : 2 × le cadre en px du manifeste, sur chaque dimension (arrondi au
  supérieur). Photo : `ID_PHOTO_MIN = 210 × 270 px` (≈ 2 × le cadre photo des templates livrés, 106 px).
- **Image illisible** (fichier absent du stockage, en-tête inconnu) lors de l'évaluation d'un
  évènement : ignorée avec `console.warn` — le rendu l'ignore déjà (`build-context.ts`), on ne bloque pas.
- **Dimensions** : mémorisées à l'enregistrement (`logoWidth`…) ; si elles manquent (évènement
  antérieur), elles sont relues dans le fichier stocké.
- **Recadrage ignoré si inutile** : une image déjà au bon ratio et assez grande est envoyée telle
  quelle (le cadrage reste disponible par le bouton « Recadrer »). Pour logo/bannière, `logoOriginal`
  pointe alors la même clé.
- **Pas de contrôle rétroactif** des valeurs inchangées : le PATCH ne valide `logo`/`banner`/`photo`
  que si la clé **change** (le formulaire renvoie toute la fiche à chaque enregistrement).
- **Librairie de recadrage : `react-easy-crop`** (maintenue, ~10 ko gzip, ratio verrouillé via
  `aspect`, gestes tactiles et molette, rend les `croppedAreaPixels` natifs). Un recadrage maison
  imposerait de réécrire pinch-zoom, inertie et bornes de déplacement pour un gain nul.
- **Lockfiles** : `package-lock.json` est périmé depuis le renommage du projet (il ne contient pas
  `@tigamadou/pdf-engine`) ; seul `yarn.lock` fait foi (Dockerfile et CI utilisent Yarn). On ne
  touche **pas** `package-lock.json` ; à signaler dans le rapport de lot.

## Fichiers du lot (exclusifs)

Modifiables (créations marquées [nouveau]) :
- API : `src/app/api/org/[orgId]/upload/**`, `src/app/api/org/[orgId]/events/[eventId]/route.ts`,
  `src/app/api/org/[orgId]/events/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/upload/**`,
  `src/app/api/upload/**`, `src/app/api/account/upload/**`, `src/app/api/account/profile/**`,
  `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route.ts` (contrôle de la photo seulement),
  `src/app/api/org/[orgId]/events/[eventId]/badges/{[badgeId],exports,batch,ids}/**`,
  `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/**`,
  `src/app/api/platform/print/sheets/**`, `src/app/api/platform/print/requests/[requestId]/onsite/**`.
- Lib : `src/lib/badge-templates/image-frames.ts` [nouveau], `src/lib/badge-templates/render-badge.ts`,
  `src/lib/event-image-compliance.ts` [nouveau], `src/lib/print-requests/{lifecycle,onsite,onsite-station}.ts`,
  `src/lib/print-sheets/{generations,run-generation}.ts`, `src/lib/storage.ts`, `src/lib/upload-token.ts`,
  `src/lib/validators/registration.ts`, `src/test/factories-2a.ts` [nouveau].
- UI : `src/components/ui/ImageCropper.tsx` [nouveau], `src/components/ui/FileBox.tsx`,
  `src/components/event/{EventSettingsForm,RegistrationForm}.tsx`, `src/components/event/EventImageAlert.tsx` [nouveau],
  `src/components/account/IdPhotoRules.tsx` [nouveau], `src/app/event/[eventId]/settings/**`,
  `src/app/event/[eventId]/page.tsx`, `src/app/event/[eventId]/registrations/new/**`, `src/app/account/profile/**`.
- Seed et e2e : `prisma/seed/demo/{images,png}.ts`, `e2e/fixtures/**`, `e2e/helpers/images-2a.ts` [nouveau],
  `e2e/event/settings.spec.ts`, `e2e/public/account-profile.spec.ts`, `e2e/event/registrations-new.spec.ts`,
  `e2e/event/images-badge.spec.ts` [nouveau].
- Dépendances : `package.json`, `yarn.lock`.
- Tests de tous ces fichiers (`__tests__/` voisins).
- Docs : `docs/v4/features/templates-badges.md` (nouvelle section « Images de l'évènement »),
  `docs/v4/features/validation-profils.md` (nouvelle section « Photo d'identité »).

**En lecture seule** (contrats du socle et autres lots) : `prisma/schema.prisma`,
`src/lib/image-dimensions.ts`, `src/lib/list-query.ts`, `src/lib/badge-list-query.ts`,
`src/components/ui/Pagination.tsx`, `src/lib/activity-labels.ts`, `src/test/factories.ts`,
`e2e/helpers/db.ts`, `prisma/seed/minimal.ts`, `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts`
(GET liste, lot 2c), `src/lib/print-requests/{errors,route,staff-api}.ts`, `BadgeListTable.tsx`,
`RequestStatusActions.tsx`, `PrintRequestActions.tsx`, `OnsiteStation.tsx`.
**Besoin d'y toucher → s'arrêter et le signaler** (statut NEEDS_CONTEXT), sans contourner.

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), valables pour tout test écrit ici :
- Vitest tourne sur une base dont le nom finit par `_test` (`badge_2a_test`), jamais sur la base de
  dev ; `make test` la crée et la met au schéma ; garde-fou dans `src/test-setup.ts`.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent
  (FedaPay, SMTP, renderer via `fakeExporter`, session NextAuth). Le stockage S3 de test (bucket
  `badge-2a-test`) est réel : écrire les images de test dans le stockage, ne pas mocker `getFile`.
- Données via les fabriques : `src/test/factories.ts` (lecture seule) et `src/test/factories-2a.ts`
  (ce lot) ; `@faker-js/faker`, graine fixée par fichier (`seedFactories`).
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander.
- Couverture **100 %** sur `src/lib/**` et `src/app/api/**` (gate dans `vitest.config.ts`) : chaque
  branche des nouveaux fichiers a son test.
- e2e (Playwright) contre l'app en cours d'exécution, fixtures préfixées et nettoyées (`e2e/helpers/db.ts`).

Autres contraintes (spec) : uploads JPEG/PNG/WebP, 5 Mo ; tolérance de ratio ± 2 % (`ratioMatches`,
défaut 0,02) ; `ID_PHOTO_RATIO = 7:9` ; messages utilisateur en français avec accents ; code en anglais ;
RBAC existant des routes inchangé ; code d'erreur `EVENT_IMAGES_NONCOMPLIANT` en 422 avec `message` ;
rejet d'upload non journalisé, changement d'image d'évènement journalisé (`EVENT_IMAGE_UPDATED`).

## Review Focus

1. **Logo bien lié mais bloc dans un groupe imbriqué** : le cadre est trouvé (Task 2).
2. **Template sans la variable** : aucune contrainte, aucun blocage ; changement de template vers un
   cadre incompatible : l'évènement devient « à recadrer » sans écriture en base (Task 3).
3. **Appel direct à l'API** avec un fichier renommé (`.png` contenant du WebP, contenu non image,
   octets tronqués) : refusé, jamais enregistré (Tasks 4, 5).
4. **Valeur inchangée renvoyée par le formulaire** (logo hérité non conforme, photo ancienne) : le
   PATCH ne le rejette pas (pas de blocage rétroactif) (Tasks 4, 5).
5. **Génération déjà en file quand l'image devient non conforme** : le worker échoue proprement
   (message) au lieu d'imprimer un badge déformé ; aperçu `?format=html` reste possible avec en-tête
   d'avertissement (Task 6).
6. **Image absente du stockage** : jamais d'exception 500 à l'évaluation (ignorée, avertissement) (Task 3).

---

### Task 1: Stack, dépendance, contrats du socle, fabriques du lot

**Files:**
- Create: `src/test/factories-2a.ts`, `src/test/__tests__/factories-2a.test.ts`
- Modify: `package.json`, `yarn.lock`

**Interfaces:**
- Consumes (socle, à vérifier présents) : `readImageDimensions(buf)`, `ratioMatches(w, h, tw, th, tol?)`,
  `ID_PHOTO_RATIO` (`src/lib/image-dimensions.ts`) ; `Event.logoOriginal|bannerOriginal|logoWidth|logoHeight|bannerWidth|bannerHeight`
  (`prisma/schema.prisma`) ; `ActivityType.EVENT_IMAGE_UPDATED` + libellé.
- Produces :
  - `makePng(width: number, height: number): Buffer` (réutilise `encodePng` de `prisma/seed/demo/png.ts`) ;
  - `makeJpegHeader(width: number, height: number): Buffer` (SOI + SOF0 + EOI, suffisant pour un lecteur d'en-têtes) ;
  - `makeWebpHeader(width: number, height: number): Buffer` (RIFF/WEBP/VP8X) ;
  - `putTestImage(key: string, buf: Buffer, contentType: string): Promise<string>` (écrit via `uploadFile`, rend `key`) ;
  - `makeFramedTemplate(installedById: string, frames: { logo?: { w: number; h: number }; banner?: { w: number; h: number }; nested?: boolean }, data?)`
    : `makeInstalledTemplate` avec un `layout` à blocs `rect` portant `image.source` et un `bindings` liant
    `event.logoDataUrl` / `event.bannerDataUrl` (`nested: true` met le bloc dans un `group`).

- [ ] **Step 1: Lancer la stack du lot**

Run: `scripts/agent-stack.sh up 2a feat/retours-client-v3 && cd ../badge-wt-2a && git status -sb`
Expected: stack `badge-ag-2a` démarrée, branche `feat/retours-client-v3-2a`, arbre propre. Si la stack principale ne tourne pas ou si `NPM_TOKEN` manque dans `.env`, s'arrêter et le signaler.

- [ ] **Step 2: Vérifier les contrats du socle**

Run: `grep -n "export" src/lib/image-dimensions.ts && grep -n "logoOriginal\|bannerOriginal\|logoWidth\|bannerHeight\|EVENT_IMAGE_UPDATED" prisma/schema.prisma src/lib/activity-labels.ts`
Expected: `readImageDimensions`, `ratioMatches`, `ID_PHOTO_RATIO` exportés ; les 6 champs `Event` et `EVENT_IMAGE_UPDATED` présents. **S'il manque quoi que ce soit (ou un nom diffère), s'arrêter et signaler** : ces fichiers sont en lecture seule.

- [ ] **Step 3: Ajouter la dépendance**

Run: `docker compose -p badge-ag-2a -f docker-compose.dev.yml -f docker-compose.agent.yml exec app yarn add react-easy-crop`
Expected: `package.json` gagne `"react-easy-crop": "^5…"` et `yarn.lock` une entrée ; `package-lock.json` inchangé (voir Décisions). Vérifier `git diff --stat` : seuls `package.json` et `yarn.lock`.

- [ ] **Step 4: Écrire le test des fabriques**

`src/test/__tests__/factories-2a.test.ts` : `makePng(420, 540)` → `readImageDimensions` rend `{ width: 420, height: 540, format: "png" }` ; idem `makeJpegHeader(300, 100)` → `format: "jpeg"` et `makeWebpHeader(64, 32)` → `format: "webp"` ; `makeFramedTemplate` sans `nested` : `layout.blocks[0].image.source === "event.logoDataUrl"` ; avec `nested: true` : le bloc est dans `blocks[0].blocks[0]` (type `group`).

- [ ] **Step 5: Run — échec attendu**

Run: `make test FILE=src/test/__tests__/factories-2a.test.ts`
Expected: FAIL (module `../factories-2a` introuvable).

- [ ] **Step 6: Implémenter `src/test/factories-2a.ts`** avec les signatures ci-dessus (JPEG : `FF D8`, segment `FF C0` longueur 11, précision 8, hauteur puis largeur en big-endian, 1 composante, `FF D9` ; WebP VP8X : largeur-1 et hauteur-1 sur 3 octets little-endian aux offsets 24 et 27).

- [ ] **Step 7: Run — succès**

Run: `make test FILE=src/test/__tests__/factories-2a.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit** — `git add package.json yarn.lock src/test && git commit -m "chore: dependance react-easy-crop et fabriques d'images du lot 2a"`

---

### Task 2: Cadres du manifeste et exigences (`image-frames.ts`)

**Files:**
- Create: `src/lib/badge-templates/image-frames.ts`, `src/lib/badge-templates/__tests__/image-frames.test.ts`

**Interfaces:**
- Consumes : `Block`, `TemplateManifest` (types de `@tigamadou/pdf-engine`), `Bindings` (`./bindings`), `ratioMatches`, `ID_PHOTO_RATIO` (socle).
- Produces (module **pur**, sans import serveur : il est aussi importé par `ImageCropper.tsx`) :
  - `type ImageFrame = { width: number; height: number }` ;
  - `findImageFrames(blocks: Block[], variable: string): ImageFrame[]` — ordre de document, groupes parcourus en profondeur ;
  - `frameForSource(manifest: Pick<TemplateManifest, "blocks">, variables: { name: string }[], bindings: Bindings, source: string): ImageFrame | null` — premier cadre parmi les variables liées à `source` ;
  - `type ImageRequirement = { ratio: { width: number; height: number }; ratioLabel: string; minWidth: number; minHeight: number; exampleWidth: number; exampleHeight: number }` (sérialisable : passé aux composants client) ;
  - `requirementFromFrame(frame: ImageFrame): ImageRequirement` ; `ID_PHOTO_MIN = { width: 210, height: 270 }` ; `ID_PHOTO_REQUIREMENT: ImageRequirement` ;
  - `simplifyRatio(width: number, height: number): [number, number]` — plus petit dénominateur ≤ 20 dont l'écart relatif ≤ 2 %, sinon dimensions arrondies ;
  - `type ImageCheck = { ok: true } | { ok: false; reason: "RATIO" | "RESOLUTION"; message: string }` ;
  - `checkAgainst(dims: { width: number; height: number }, req: ImageRequirement): ImageCheck` — ratio d'abord, puis résolution. Messages : `Ratio attendu 3:1, par ex. 1500 × 500 px.` / `Image trop petite : 1500 × 500 px minimum (reçue : 300 × 100 px).` ;
  - `computeCropOutput(area: { width: number; height: number }, req: ImageRequirement): { width: number; height: number }` — largeur = `clamp(area.width, minWidth, 3 × minWidth)` arrondie, hauteur = `round(largeur × ratio.height / ratio.width)`.

- [ ] **Step 1: Écrire les tests** (`image-frames.test.ts`), valeurs exactes :
  - `findImageFrames` : un `rect` `{w: 68, h: 68, image: {source: "logo"}}` → `[{width: 68, height: 68}]` ; même bloc dans un `group` imbriqué sur 2 niveaux → trouvé ; bloc sans `image`, bloc `text`, `list` et image d'une autre source → ignorés ; deux blocs → ordre de document conservé.
  - `frameForSource` : variable `logo` liée à `event.logoDataUrl` (nom ≠ source) → cadre du bloc qui référence `logo` ; deux variables liées à la même source → premier bloc en ordre de document ; aucune liaison / bloc absent → `null` ; liaison `null` ou `"option"` → `null`.
  - `requirementFromFrame({width: 750, height: 250})` → `ratioLabel "3:1"`, `minWidth 1500`, `minHeight 500`, exemple `1500 × 500` ; `{68, 68}` → `"1:1"`, min `136 × 136` ; `{106, 150}` → `"5:7"` (tolérance 2 %) ; cadre `{279.69, 396.85}` → min `560 × 794`.
  - `checkAgainst` : `1500×500` vs 3:1 → ok ; `1520×500` (+1,33 %) ok ; `1530×500` (+2,0000…18 %, `ratioMatches` renvoie `false`) hors tolérance → `RATIO` ; `1600×500` → `RATIO` avec message exact ci-dessus ; `300×100` → `RESOLUTION` ; `ID_PHOTO_REQUIREMENT` : `420×540` ok, `540×540` RATIO `Ratio attendu 7:9, par ex. 210 × 270 px.`, `140×180` RESOLUTION.
  - `computeCropOutput({width: 5000, height: 1666}, req 3:1 min 1500)` → `4500 × 1500` ; `{width: 800, …}` → `1500 × 500` (plancher).

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/lib/badge-templates/__tests__/image-frames.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `image-frames.ts`** avec les signatures ci-dessus. Les blocs à image sont les formes pleines (`"image" in b && b.image?.source`) ; lire le type `Block` du moteur (dans le conteneur, `node_modules/@tigamadou/pdf-engine`) et, pour une forme dont la taille n'est pas `w`/`h` (ex. `square`, `circle`), dériver `width`/`height` de ses champs réels et ajouter le cas au test. Ne pas modifier le moteur.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/lib/badge-templates/__tests__/image-frames.test.ts`
Expected: PASS, couverture du fichier à 100 %.

- [ ] **Step 5: Commit** — `git add src/lib/badge-templates && git commit -m "feat: cadres d'image du manifeste et exigences de dimensions"`

---

### Task 3: Conformité serveur (`event-image-compliance.ts`)

**Files:**
- Create: `src/lib/event-image-compliance.ts`, `src/lib/__tests__/event-image-compliance.test.ts`

**Interfaces:**
- Consumes : Task 2 ; `resolveEventTemplateId`, `findEffectiveTemplateRow` (`badge-templates/event-template-variables`) ; `readLayout` (`badge-templates/resolve`) ; `getFile` (`storage`) ; `readImageDimensions` (socle) ; `prisma`.
- Produces :
  - `type ImageSlot = "logo" | "banner"` ; `SLOT_SOURCE = { logo: "event.logoDataUrl", banner: "event.bannerDataUrl" }` ; `SLOT_LABEL = { logo: "logo", banner: "bannière" }` ;
  - `EVENT_IMAGE_SELECT` (`satisfies Prisma.EventSelect` : `id, orgId, badgeTemplateId, logo, banner, logoWidth, logoHeight, bannerWidth, bannerHeight`) ;
  - `getEventImageRequirements(event: { badgeTemplateId: string | null; orgId: string }): Promise<Partial<Record<ImageSlot, ImageRequirement>>>` — template illisible ou absent → `{}` + `console.warn` ;
  - `type ImageIssue = { slot: ImageSlot; reason: "RATIO" | "RESOLUTION"; message: string; expected: ImageRequirement; actual: { width: number; height: number } }` ;
  - `evaluateEventImages(event: EventImageSource): Promise<ImageIssue[]>` (`EventImageSource` = type de `EVENT_IMAGE_SELECT`) ;
  - `readStoredDimensions(key: string): Promise<{ width: number; height: number; format: "jpeg" | "png" | "webp" } | null>` ;
  - `type UploadVerdict = { ok: true; width: number; height: number } | { ok: false; status: 400 | 415 | 422; code: "INVALID_IMAGE" | "UNSUPPORTED_FORMAT" | "IMAGE_RATIO" | "IMAGE_RESOLUTION"; message: string }` ;
  - `validateImageBuffer(buf: Buffer, mime: string, req: ImageRequirement | null, opts?: { engineFormatsOnly?: boolean }): UploadVerdict` — dimensions illisibles ou format différent du type MIME → 400 `INVALID_IMAGE` ; WebP avec `engineFormatsOnly` → 415 `UNSUPPORTED_FORMAT` ; `req` nul → seulement ces contrôles ;
  - `validateStoredImage(key: string, req: ImageRequirement | null, opts?): Promise<UploadVerdict>` — clé absente du stockage → 400 `INVALID_IMAGE` « Image introuvable. » ;
  - `class EventImagesNoncompliantError extends Error { code = "EVENT_IMAGES_NONCOMPLIANT"; httpStatus = 422; issues: ImageIssue[] }` ;
  - `assertEventImagesCompliant(event: EventImageSource): Promise<void>` ; `assertEventImagesCompliantById(eventId: string): Promise<void>` (évènement inconnu → no-op) ;
  - `eventImagesErrorResponse(err: EventImagesNoncompliantError): NextResponse` → `{ error, code, message, issues }`, statut 422 ; `message` : « Images de l'évènement à recadrer : logo — Ratio attendu 1:1, par ex. 136 × 136 px. Corrigez-les dans les paramètres de l'évènement avant de générer les badges. ».

- [ ] **Step 1: Écrire les tests** (vrai MySQL + stockage de test ; `makeOrg`, `makeEvent`, `makeStaff`, `makeFramedTemplate`, `putTestImage`) :
  - `getEventImageRequirements` : template d'évènement avec logo 68×68 et bannière 750×250 → `logo.ratioLabel "1:1"`, `banner.ratioLabel "3:1"` ; cascade : évènement sans template + organisation avec template → celui de l'organisation ; template sans la variable → `{}` ; layout illisible (`layout: "x"`) → `{}` sans exception.
  - `evaluateEventImages` : logo 136×136 avec `logoWidth/Height` mémorisés → `[]` ; logo 300×100 → une issue `slot: "logo"`, `reason: "RATIO"` ; **changer le template de l'évènement vers un cadre 3:1 rend le même logo non conforme sans modifier la base** ; dimensions nulles → relues dans le fichier stocké ; clé inexistante → ignorée (`[]`) et `console.warn` appelé ; pas d'image → `[]` ; image trop petite → `RESOLUTION`.
  - `validateImageBuffer` : PNG 420×540 vs `ID_PHOTO_REQUIREMENT` ok avec `width/height` ; octets quelconques → 400 `INVALID_IMAGE` ; PNG déclaré `image/jpeg` → 400 ; WebP + `engineFormatsOnly` → 415 `UNSUPPORTED_FORMAT` ; ratio faux → 422 `IMAGE_RATIO` + message exact ; `req: null` + PNG valide → ok.
  - `validateStoredImage` : clé absente → 400 ; clé valide → verdict identique à `validateImageBuffer`.
  - `assertEventImagesCompliant` lève `EventImagesNoncompliantError` (`code`, `httpStatus 422`, `issues`) ; `…ById` inconnu → no-op ; `eventImagesErrorResponse` : statut 422, corps `code "EVENT_IMAGES_NONCOMPLIANT"`, `message` exact.

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/lib/__tests__/event-image-compliance.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter** `src/lib/event-image-compliance.ts`. Template : `findEffectiveTemplateRow(await resolveEventTemplateId(event))`, `readLayout(row)`, `frameForSource(manifest, manifest.variables, bindings, SLOT_SOURCE[slot])`, le tout dans un `try/catch` (échec → `{}`). Ne rien écrire en base. Messages : `Ratio attendu …` / `Image trop petite …` issus de `checkAgainst`.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/lib/__tests__/event-image-compliance.test.ts`
Expected: PASS, fichier à 100 % (lignes, branches).

- [ ] **Step 5: Commit** — `git add src/lib && git commit -m "feat: conformite des images de l'evenement au template effectif"`

---

### Task 4: Logo / bannière : route d'envoi, PATCH évènement, création

**Files:**
- Modify: `src/app/api/org/[orgId]/upload/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/route.ts`, `src/app/api/org/[orgId]/events/route.ts`
- Test: `src/app/api/org/[orgId]/upload/__tests__/route.test.ts`, `src/lib/__tests__/api-event-settings.test.ts` (ou le fichier de test existant du PATCH évènement), test de `events/route.ts`

**Interfaces:**
- Consumes : Task 3 (`getEventImageRequirements`, `validateImageBuffer`, `validateStoredImage`, `readStoredDimensions`), `logActivity` avec `EVENT_IMAGE_UPDATED`.
- Produces :
  - `POST /api/org/:orgId/upload?purpose=logo|banner&eventId=…` → `{ storageKey, width, height }` ; `purpose=original` → `{ storageKey }` ; sans `purpose` → comportement actuel inchangé (logo d'organisation, `SettingsClient.tsx` et images d'options du template) ; `purpose` inconnu → 400 `BAD_PURPOSE` ; `purpose=logo|banner` sans `eventId`, ou évènement d'une autre organisation → 404 `NOT_FOUND`. Erreurs d'image : `{ error: message, code, message }` avec le statut du verdict.
  - `PATCH /api/org/:orgId/events/:eventId` accepte `logoOriginal`, `bannerOriginal` (`string | null`, ≤ 500) ; quand `logo`/`banner` **change** et n'est pas `null` : relecture du fichier par sa clé (`validateStoredImage(key, requirement, { engineFormatsOnly: true })`), rejet 4xx `{ error, code, message, slot }` sinon ; en cas de succès `logoWidth/Height` (resp. banner) mémorisés ; `null` efface clé, dimensions et original ; un `logo` identique à la valeur stockée n'est pas revalidé. Journal `EVENT_IMAGE_UPDATED` `{ slot, removed: boolean }` par image changée (en plus de `EVENT_UPDATED`).
  - `POST …/events` : si `logo` fourni, `logoWidth/Height` mémorisés via `readStoredDimensions` (échec → `null`), sans rejet.

- [ ] **Step 1: Écrire les tests** (réutiliser le motif de session NextAuth mockée des tests voisins ; images via `putTestImage`) :
  - Upload : `purpose=logo` + PNG 136×136 vers un évènement dont le template cadre le logo 68×68 → 200 `{ storageKey, width: 136, height: 136 }` ; PNG 300×100 → 422 `IMAGE_RATIO`, message `Ratio attendu 1:1, par ex. 136 × 136 px.`, **rien d'écrit** (compter les objets sous `orgs/:orgId/images/`) ; `purpose=logo` d'un template sans la variable → 200 ; WebP en `purpose=logo` → 415 ; WebP en `purpose=original` → 200 ; fichier `.png` contenant du texte → 400 `INVALID_IMAGE` ; `purpose=zzz` → 400 `BAD_PURPOSE` ; `purpose=banner` sans `eventId` → 404 ; sans `purpose` : PNG 1×1 accepté comme avant ; rôle < MANAGER → refus (test existant conservé).
  - PATCH : nouveau `logo` conforme → 200, `event.logoWidth === 136`, une ligne `EVENT_IMAGE_UPDATED` ; nouveau `logo` 300×100 → 422 (`code IMAGE_RATIO`, `slot "logo"`), colonne inchangée ; clé inexistante → 400 `INVALID_IMAGE` ; renvoyer le même `logo` non conforme (stocké avant changement de template) avec un autre titre → 200 (pas de blocage rétroactif) ; `logo: null` → clé, dimensions et `logoOriginal` à `null`, journal `removed: true` ; `logoOriginal` enregistré tel quel ; **un test existant qui PATCHe un `logo` factice** doit écrire une vraie image avec `putTestImage` (adapter le test, pas la route).
  - Création : évènement créé avec un `logo` valide → `logoWidth/Height` renseignés ; logo introuvable → 201 et dimensions `null`.

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/app/api/org`
Expected: FAIL sur les nouveaux cas (comportements absents).

- [ ] **Step 3: Implémenter** upload (`purpose`, tables d'extension existantes conservées), PATCH (étendre le `select` de `before` avec `logo`, `banner`, `badgeTemplateId`, `orgId` ; calculer `getEventImageRequirements(before)` une seule fois, seulement si une image change) et création. Ne pas ajouter de contrôle de préfixe de clé.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/app/api/org`
Expected: PASS ; routes modifiées à 100 %.

- [ ] **Step 5: Commit** — `git add src/app/api/org && git commit -m "feat: controle serveur du ratio du logo et de la banniere, original conserve"`

---

### Task 5: Photo du participant : contrôle serveur sur tous les chemins

**Files:**
- Modify: `src/app/api/account/upload/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/upload/route.ts`, `src/app/api/upload/route.ts` (legacy, non appelée par l'UI), `src/app/api/account/profile/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route.ts`
- Test : tests voisins de chaque route (`__tests__/route.test.ts`, tests `api-event-registrations`, profil)

**Interfaces:**
- Consumes : `validateImageBuffer`, `validateStoredImage`, `ID_PHOTO_REQUIREMENT` (Tasks 2-3).
- Produces : pour **`kind=photo`** uniquement, les trois routes d'envoi rejettent un fichier hors ratio 7:9 (± 2 %) ou sous 210 × 270 px (statuts/codes du verdict, corps `{ code, error, message }`) ; `PATCH /api/account/profile` revalide `photo` seulement si elle diffère de la valeur stockée ; `PATCH …/registrations/:regId` revalide `snapshotPhoto` seulement si elle diffère. `kind=document` inchangé. Le serveur ne contrôle pas la photo à la création d'une inscription (`registrations/route.ts` POST recopie le profil, pas de photo dans le corps) : fichier non modifié.

- [ ] **Step 1: Écrire les tests** :
  - Chaque route d'envoi, `kind=photo` : PNG 420×540 → 200 ; PNG 540×540 → 422 `IMAGE_RATIO` (« Ratio attendu 7:9, par ex. 210 × 270 px. ») ; PNG 140×180 → 422 `IMAGE_RESOLUTION` ; ratio à +1,9 % accepté, +2,1 % refusé ; octets non image → 400 ; `kind=document` avec PDF/PNG quelconque → toujours accepté ; route legacy `api/upload` : mêmes cas (créer un évènement ouvert, `context=event:<slug>`).
  - Profil : PATCH `photo` = clé d'un PNG 540×540 → 422 et colonne inchangée ; clé d'un PNG 420×540 → 200 ; même clé que l'existante (photo ancienne non conforme) avec un autre champ → 200 ; clé absente du stockage → 400.
  - Inscription : PATCH `snapshotPhoto` non conforme → 422, conforme → 200, inchangée → 200.
  - Adapter les tests existants qui envoient une photo de test : utiliser `makePng(420, 540)` (pas de modification des routes pour les contenter).

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/app/api/account && make test FILE=src/app/api/upload && make test FILE=src/app/api/org`
Expected: FAIL sur les nouveaux cas.

- [ ] **Step 3: Implémenter** : appel de `validateImageBuffer(buffer, mime, ID_PHOTO_REQUIREMENT)` après la lecture du buffer et avant `uploadFile` (photo seulement) ; `validateStoredImage(data.photo, ID_PHOTO_REQUIREMENT)` après le chargement de `before` dans le profil.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/app/api/account && make test FILE=src/app/api/upload && make test FILE=src/app/api/org`
Expected: PASS ; routes modifiées à 100 %.

- [ ] **Step 5: Commit** — `git add src/app/api && git commit -m "feat: controle du ratio 7:9 de la photo sur tous les chemins d'envoi"`

---

### Task 6: Blocage : rendu PDF, aperçu, exports, planches

**Files:**
- Modify: `src/lib/badge-templates/render-badge.ts`, `src/lib/print-sheets/generations.ts`, `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/badges/exports/route.ts`, `src/app/api/platform/print/sheets/route.ts`
- Test : `src/lib/badge-templates/__tests__/render-badge.test.ts`, `…/badges/[badgeId]/__tests__/route.test.ts`, tests des exports, de `generations`, de `run-generation`, de `api-platform-print-sheets*`

**Interfaces:**
- Consumes : `assertEventImagesCompliant`, `assertEventImagesCompliantById`, `evaluateEventImages`, `eventImagesErrorResponse`, `EventImagesNoncompliantError`.
- Produces :
  - `badgeRegistrationInclude.event.select` gagne `logoWidth, logoHeight, bannerWidth, bannerHeight` ;
  - `renderBadgePdf(registration)` lève `EventImagesNoncompliantError` avant tout rendu ; `renderBadgeHtml` / `renderBadgeDocument` ne bloquent pas ;
  - `badgeRenderFailure(err, …)` rend `eventImagesErrorResponse(err)` (422) pour cette erreur ;
  - `GET …/badges/:badgeId?format=html` ajoute `x-event-images: noncompliant` et `x-event-images-slots: logo,banner` (créneaux fautifs) quand `evaluateEventImages` trouve des issues ; l'aperçu reste servi ;
  - `createGeneration` et `createZipExport` lèvent `EventImagesNoncompliantError` avant de créer la ligne (le `select` de l'évènement dans `createGeneration` devient `EVENT_IMAGE_SELECT`) ; les routes `sheets` POST et `exports` POST la traduisent par `eventImagesErrorResponse` (422) ; la génération déjà en file échoue côté worker via le garde de `renderBadgePdf` (statut `FAILED`, `error` = message).

- [ ] **Step 1: Écrire les tests** (évènement avec `makeFramedTemplate` logo 68×68 et un logo stocké 300×100 ; `fakeExporter` pour le rendu) :
  - `renderBadgePdf` : lève `EventImagesNoncompliantError`, `fakeExporter` n'a reçu aucun appel ; avec logo conforme → PDF rendu ; `renderBadgeHtml` avec logo non conforme → document rendu (pas d'erreur).
  - Route `[badgeId]` PDF : 422, `code "EVENT_IMAGES_NONCOMPLIANT"`, message exact (Task 3) ; `?format=html` : 200 + en-têtes `x-event-images: noncompliant` et `x-event-images-slots: logo` ; conforme : 200 sans ces en-têtes.
  - `createGeneration` (mode `ALL` et mode `REQUEST`) et `createZipExport` : rejettent, **aucune** ligne `PrintSheetGeneration` créée ; routes `sheets` POST et `exports` POST : 422 `EVENT_IMAGES_NONCOMPLIANT` ; une planche déjà `DONE` reste téléchargeable.
  - `runGeneration` avec rendu réel (`defaultRunDeps`) sur évènement non conforme : retourne `"FAILED"`, `error` contient « Images de l'évènement à recadrer ». Si le chemin d'erreur existant ne fixe pas l'état `FAILED` ainsi, **s'arrêter et signaler** plutôt que de modifier la logique du worker au-delà de ce test.
  - Évènement dont le template n'utilise pas le logo : génération et PDF fonctionnent (régression).

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/lib/badge-templates && make test FILE=src/lib/print-sheets && make test FILE=src/app/api/platform/print/sheets`
Expected: FAIL sur les nouveaux cas.

- [ ] **Step 3: Implémenter** conformément aux Interfaces ; `await assertEventImagesCompliant(registration.event)` en première instruction de `renderBadgePdf`.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/lib/badge-templates && make test FILE=src/lib/print-sheets && make test FILE=src/lib/__tests__/api-event-badge-exports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add src && git commit -m "feat: blocage du rendu, des exports et des planches tant que les images sont non conformes"`

---

### Task 7: Blocage : soumission de commande, impression sur place

**Files:**
- Modify: `src/lib/print-requests/lifecycle.ts`, `src/lib/print-requests/onsite-station.ts`, `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/route.ts`, `src/app/api/platform/print/requests/[requestId]/onsite/print/route.ts`
- Test : `src/lib/print-requests/__tests__/…` (lifecycle, onsite-station), `src/lib/__tests__/api-event-print-requests.test.ts`, `src/lib/__tests__/api-platform-print-onsite.test.ts`

**Interfaces:**
- Consumes : `assertEventImagesCompliantById`, `eventImagesErrorResponse`, `EventImagesNoncompliantError`.
- Produces : `submitRequest` (types ADVANCE et ONSITE) lève `EventImagesNoncompliantError` après `loadRequest` et **avant** la transaction ; `recordOnsitePrint` la lève avant sa transaction (évènement lu depuis la commande) ; les deux routes l'interceptent (le premier `catch` autour de l'appel, avant le traducteur d'erreurs existant `organizerRoute` / `guarded`, qui relancerait une erreur inconnue en 500) et rendent `eventImagesErrorResponse` (422). `src/lib/print-requests/errors.ts` (lecture seule) n'est pas touché.

- [ ] **Step 1: Écrire les tests** :
  - `submitRequest` : commande DRAFT valide (ADVANCE avec badge, ONSITE complète) sur évènement non conforme → lève l'erreur, **statut toujours `DRAFT`**, aucun évènement de fil ni notification ; évènement conforme → soumise (régression) ; route submit → 422 `EVENT_IMAGES_NONCOMPLIANT` ; commande déjà soumise avant le changement de template : non remise en cause (aucun appel au garde sur les autres transitions).
  - `recordOnsitePrint` : évènement non conforme → lève, aucune ligne `PrintRequestPrint`, `badgePrinted` inchangé ; route `onsite/print` → 422 ; conforme → 201 (régression).

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/lib/print-requests && make test FILE=src/lib/__tests__/api-event-print-requests.test.ts && make test FILE=src/lib/__tests__/api-platform-print-onsite.test.ts`
Expected: FAIL sur les nouveaux cas.

- [ ] **Step 3: Implémenter** conformément aux Interfaces.

- [ ] **Step 4: Run — succès**

Run: mêmes commandes.
Expected: PASS ; fichiers modifiés à 100 %.

- [ ] **Step 5: Commit** — `git add src && git commit -m "feat: blocage de la soumission de commande et de l'impression sur place"`

---

### Task 8: Composant `ImageCropper`

**Files:**
- Create: `src/components/ui/ImageCropper.tsx`, `src/components/ui/__tests__/ImageCropper.test.tsx`
- Modify: `src/components/ui/FileBox.tsx` (prop `warning?: ReactNode` affichée sous le sous-titre, ton ambre), `src/components/ui/__tests__/FileBox.test.tsx`

**Interfaces:**
- Consumes : `ImageRequirement`, `checkAgainst`, `computeCropOutput` (`image-frames.ts`, pur) ; `Dialog` (`./Dialog`) ; `Button` ; `react-easy-crop`.
- Produces :
  - `ImageCropper(props: { open: boolean; title: string; source: Blob | string | null; requirement: ImageRequirement; outputMime: "image/png" | "image/jpeg"; onConfirm: (blob: Blob) => void; onCancel: () => void })` — dialogue : zone de cadrage au ratio verrouillé (`aspect = ratio.width / ratio.height`), zoom, rappel « Format attendu : 3:1, par ex. 1500 × 500 px », bouton « Valider le cadrage » (désactivé tant que la zone n'est pas calculée **ou** si la zone recadrée est sous `minWidth × minHeight` — alors message « Image trop petite pour ce cadre : envoyez-en une autre (minimum … px). »), bouton « Annuler » ;
  - `readImageSize(source: Blob | string): Promise<{ width: number; height: number }>` ;
  - `isConforming(size, requirement): boolean` (= `checkAgainst(...).ok`) — sert à envoyer sans cadrage une image déjà bonne ;
  - `cropToBlob(source, area: { x: number; y: number; width: number; height: number }, requirement, mime): Promise<Blob>` — canvas à `computeCropOutput(area, requirement)`, JPEG qualité 0,92.
  - `outputMimeFor(file: Blob): "image/png" | "image/jpeg"` — PNG pour PNG/WebP (transparence conservée), JPEG pour JPEG.

- [ ] **Step 1: Écrire les tests** (rendu statique `renderToStaticMarkup`, comme `FileBox.test.tsx` ; le comportement canvas est couvert en e2e, Task 12) : `FileBox` avec `warning="À recadrer"` affiche le texte ; `outputMimeFor(new Blob([], {type: "image/webp"}))` → `image/png`, `image/jpeg` → `image/jpeg` ; `isConforming({width: 420, height: 540}, ID_PHOTO_REQUIREMENT)` vrai, `{540, 540}` faux ; rendu de `DialogPanel`-équivalent avec `open={false}` → rien (`""`).

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/components/ui`
Expected: FAIL (module ou prop absents).

- [ ] **Step 3: Implémenter** : `"use client"`, chargement dynamique de `react-easy-crop` seulement à l'ouverture (`next/dynamic`, `ssr: false`) pour ne pas alourdir les pages ; objet URL révoqué à la fermeture ; focus et Échap gérés par `Dialog`. Dialogue utilisable à 375 px (zone de cadrage `h-64` sur mobile, `sm:h-96`).

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/components/ui && make typecheck && make lint`
Expected: PASS ; 0 erreur de type, 0 avertissement de lint.

- [ ] **Step 5: Commit** — `git add src/components && git commit -m "feat: composant de recadrage a ratio verrouille"`

---

### Task 9: Interface évènement : réglages, bandeau, tableau de bord

**Files:**
- Create: `src/components/event/EventImageAlert.tsx`, `src/components/event/__tests__/EventImageAlert.test.tsx`
- Modify: `src/components/event/EventSettingsForm.tsx`, `src/app/event/[eventId]/settings/page.tsx`, `src/app/event/[eventId]/settings/badge/page.tsx`, `src/app/event/[eventId]/page.tsx`

**Interfaces:**
- Consumes : Tasks 3, 4, 8 ; `Alert` (`ui/Feedback`).
- Produces :
  - `EventImageAlert({ eventId, issues }: { eventId: string; issues: Pick<ImageIssue, "slot" | "message">[] })` — composant serveur ; `null` si aucune issue ; sinon `Alert tone="warn"` « Images à recadrer : logo — … La génération des badges est bloquée tant qu'elles ne sont pas conformes. » avec lien vers `/event/:eventId/settings` ;
  - la page `settings` calcule `getEventImageRequirements` + `evaluateEventImages` et passe à `EventSettingsForm` : `imageRequirements: Partial<Record<ImageSlot, ImageRequirement>>`, `imageIssues: Partial<Record<ImageSlot, string>>`, et dans `initial.event` : `logoOriginal`, `bannerOriginal` ;
  - le tableau de bord évènement (hors rôle OPERATOR) et la page `settings/badge` affichent `EventImageAlert` (sur `settings/badge`, l'aperçu du template reste utilisable : c'est l'avertissement demandé).

Comportement de `EventSettingsForm` pour chaque emplacement (logo, bannière) :
1. Le **format attendu s'affiche avant l'envoi** dans le sous-titre du `Dropzone` : « Format attendu : 3:1, par ex. 1500 × 500 px (minimum 1500 × 500) — JPEG, PNG ou WebP, 5 Mo max » ; sans exigence (template sans la variable) : « Aucune contrainte de format pour le modèle de badge actuel ».
2. Choix d'un fichier : avec exigence et image non conforme → `ImageCropper` ; image conforme ou sans exigence → envoi direct. Envoi : l'original (`purpose=original`, sauté si l'image part telle quelle) puis la version recadrée (`purpose=logo|banner&eventId=…`) ; les clés vont dans l'état et partent au `PATCH` existant avec `logoOriginal`/`bannerOriginal`.
3. Image enregistrée : `FileBox` avec bouton **« Recadrer »** (source = original s'il existe, sinon l'image courante) en plus de « Retirer » ; une image non conforme porte `warning` (« À recadrer : ratio attendu 1:1 ») ; si la source est trop petite pour le nouveau cadre, le message du cadrage invite à en envoyer une autre.
4. Les images d'options de template (`uploadOptionImage`) continuent de poster sans `purpose` (inchangé).
5. Rejet serveur (422 `IMAGE_RATIO`…) : `toastApiError` affiche le `message`.

- [ ] **Step 1: Écrire les tests** : `EventImageAlert` sans issue → `""` ; avec issues → contient « Images à recadrer », le message de chaque issue et un lien `/event/<id>/settings` (rendu statique). Le formulaire est couvert en e2e (Task 12) : composant client, hors périmètre de couverture Vitest.

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/components/event/__tests__/EventImageAlert.test.tsx`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter** le composant, le calcul côté pages serveur et le formulaire selon le comportement ci-dessus. Mise en page : les deux zones d'envoi s'empilent < `sm`, la `FileBox` passe son bouton sous le texte à 375 px.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/components/event && make typecheck && make lint`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add src && git commit -m "feat: recadrage du logo et de la banniere, bandeau images a recadrer"`

---

### Task 10: Interface photo : compte, inscription, règles de la photo d'identité

**Files:**
- Create: `src/components/account/IdPhotoRules.tsx`, `src/components/account/__tests__/IdPhotoRules.test.tsx`
- Modify: `src/app/account/profile/ProfileForm.tsx`, `src/components/event/RegistrationForm.tsx` (champ `Photo` seulement)

**Interfaces:**
- Consumes : `ImageCropper`, `isConforming`, `readImageSize`, `ID_PHOTO_REQUIREMENT`.
- Produces : `IdPhotoRules()` — liste affichée près de l'envoi : « Visage de face et centré », « Fond blanc uni », « Tête nue (sauf motif religieux) et sans lunettes de soleil », « Photo nette et bien éclairée », « Photo récente », « Pas de filtre ni de retouche », plus « Format 7:9 (35 × 45 mm), minimum 210 × 270 px » ; `ProfileForm` et `RegistrationForm` : choisir une photo ouvre le cadrage 7:9 sauf si elle est déjà conforme (envoi direct) ; une photo enregistrée a un bouton « Recadrer ».

- [ ] **Step 1: Écrire le test** : rendu statique de `IdPhotoRules` contient les six règles et « 7:9 ».

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=src/components/account`
Expected: FAIL.

- [ ] **Step 3: Implémenter** : `IdPhotoRules` placé dans la `FormSection` « Photo » de `ProfileForm` (au-dessus de l'`input`) et au-dessus du champ photo de `RegistrationForm` ; description de la section : « JPEG, PNG ou WebP — 5 Mo maximum — format photo d'identité 7:9 ». Le sélecteur `accept` reste `image/jpeg,image/png,image/webp` (les sélecteurs e2e en dépendent). Le fichier envoyé est le résultat du cadrage (`cropToBlob`, `File` nommé `photo.png|jpg`). Vérification de l'état réel : `RegistrationForm` poste des champs que `registrations/route.ts` POST (`categoryId` + `userId|email`) n'accepte pas ; ne pas corriger ce flux (hors lot) mais le signaler si le test e2e `registrations-new` le confirme.

- [ ] **Step 4: Run — succès**

Run: `make test FILE=src/components/account && make typecheck && make lint`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add src && git commit -m "feat: recadrage 7:9 et regles de la photo d'identite"`

---

### Task 11: Seed démo et fixtures e2e conformes

**Files:**
- Modify: `prisma/seed/demo/images.ts`, `prisma/seed/demo/png.ts` (si besoin d'un encodeur plus rapide), `e2e/fixtures/index.ts`, tests voisins du seed (`prisma/seed/demo/__tests__/…`)
- Create: `e2e/helpers/images-2a.ts`

**Interfaces:**
- Consumes : `encodePng` ; `ID_PHOTO_MIN`, `requirementFromFrame` (Task 2).
- Produces :
  - seed : `photos` 30 × `210×270`, `logos` 12 × `136×136` (cadre 68 × 68 du template `recto-verso`), `banners` 8 × `1500×500` ; `paint` reste déterministe ; l'écriture reste séquentielle ; temps du seed démo non dégradé de plus de quelques secondes (cellule de dégradé `CELL` augmentée proportionnellement si besoin) ;
  - `ensureFixtures()` : `FixturePaths` gagne `photo` (PNG 420×540, `awa-photo.png`), `square` (PNG 600×600), `wide` (PNG 1800×600), `tiny` (l'ancien JPEG de 332 octets, `awa-tiny.jpg`) ; **`jpeg` pointe désormais `awa-photo.png`** (nom historique : les specs hors lot, ex. `e2e/public/event-register-newcomer.spec.ts`, envoient `fixtures.jpeg` comme photo ; une photo déjà 7:9 part sans cadrage et passe le contrôle) ;
  - `e2e/helpers/images-2a.ts` : `installFramedTemplate(opts: { adminId: string; eventId: string; logo?: { w: number; h: number }; banner?: { w: number; h: number } }): Promise<{ id: string; cleanup(): Promise<void> }>` (s'inspire de `installE2ETemplate` dans `e2e/helpers/db.ts`, lecture seule : crée un `InstalledBadgeTemplate` encadrant les variables et l'affecte à l'évènement), `seedEventImage(eventId, slot, buffer)` (écrit l'image dans le stockage et la colonne), `confirmCrop(page)` (clique « Valider le cadrage »).

- [ ] **Step 1: Écrire/adapter les tests du seed** : les clés générées ont les dimensions annoncées (`readImageDimensions` sur chaque lot : `210×270`, `136×136`, `1500×500`) ; le test existant du seed qui comptait les images reste vrai.

- [ ] **Step 2: Run — échec attendu**

Run: `make test FILE=prisma/seed`
Expected: FAIL sur les dimensions.

- [ ] **Step 3: Implémenter** seed et fixtures (les fixtures écrivent leurs PNG avec `encodePng`, idempotent comme aujourd'hui).

- [ ] **Step 4: Run — succès, puis contrôle du seed**

Run: `make test FILE=prisma/seed && make db-seed`
Expected: PASS ; le seed démo s'exécute sans erreur (si `make db-seed` n'efface pas la base du worktree 2a, sinon demander).

- [ ] **Step 5: Commit** — `git add prisma e2e && git commit -m "chore: seed demo et fixtures e2e aux bonnes dimensions d'image"`

---

### Task 12: e2e Playwright et contrôle 375 / 1024 / 1280 px

**Files:**
- Create: `e2e/event/images-badge.spec.ts`
- Modify: `e2e/event/settings.spec.ts`, `e2e/public/account-profile.spec.ts`, `e2e/event/registrations-new.spec.ts`

**Interfaces:**
- Consumes : `installFramedTemplate`, `seedEventImage`, `confirmCrop`, fixtures `photo`/`square`/`wide`/`tiny` (Task 11), helpers existants (`createTestEvent`, `makeEventAdminUser`, `loginAndEnter`, `getDb`).

- [ ] **Step 1: Écrire les parcours** :
  - `settings.spec.ts` : le test « ADMIN televerse un logo d'evenement » utilise `fixtures.square` sur un évènement au template cadrant le logo en 1:1 → pas de cadrage (conforme) → bouton « Retirer » visible, `logoWidth` renseigné en base ; nouveau test : `fixtures.wide` + cadre 1:1 → le dialogue de cadrage s'ouvre, le format attendu « 1:1 » est lisible **avant** l'envoi, `confirmCrop`, enregistrer → en base `logoWidth === logoHeight` (±2 %) et `logoOriginal` ≠ `logo`.
  - `images-badge.spec.ts` : (1) rejet direct via `page.request.post` : `tiny` en `purpose=logo` → 422/400 avec message ; (2) changement de template : évènement avec logo 1:1 valide, `installFramedTemplate` 3:1 → le tableau de bord affiche « Images à recadrer », puis le PDF `/api/org/…/badges/:id` répond 422 et la page de commande refuse l'envoi ; (3) « Recadrer » sur l'image existante sans la renvoyer → le bandeau disparaît et le PDF répond 200 ; (4) l'aperçu `?format=html` reste 200 avec l'en-tête `x-event-images`.
  - `account-profile.spec.ts` : photo `fixtures.wide` → cadrage 7:9 → enregistrement → la photo stockée est 7:9 ; les règles de la photo d'identité sont visibles près de l'envoi ; appel direct d'une photo carrée → 422. `registrations-new.spec.ts` : photo `fixtures.photo` envoyée directement.
  - Contrôle responsive (`page.setViewportSize`) à **375, 1024 et 1280 px** : réglages évènement (dropzones, `FileBox` avec bouton « Recadrer »), dialogue de cadrage (zone visible, boutons atteignables sans défilement horizontal), bandeau du tableau de bord (le menu latéral occupe ~224 px dès `lg`), profil compte. Assertions : `document.documentElement.scrollWidth <= innerWidth` et boutons « Valider le cadrage » / « Annuler » visibles. Compléter par un contrôle visuel dans le navigateur (`https://badge.local` ou `localhost:3790`), golden path + cas limites, à noter dans `## Progression`.

- [ ] **Step 2: Run — échec attendu avant correction éventuelle**

Run: `make test-e2e FILE=e2e/event/images-badge.spec.ts`
Expected: PASS si les Tasks 4-11 sont corrects ; sinon corriger le **code** fautif (jamais assouplir l'assertion). Pas d'e2e en parallèle sur la même stack.

- [ ] **Step 3: Run des specs touchées**

Run: `make test-e2e FILE=e2e/event/settings.spec.ts && make test-e2e FILE=e2e/public/account-profile.spec.ts && make test-e2e FILE=e2e/event/registrations-new.spec.ts && make test-e2e FILE=e2e/public/event-register-newcomer.spec.ts && make test-e2e FILE=e2e/org/settings.spec.ts`
Expected: PASS (les deux dernières n'appartiennent pas au lot : elles vérifient seulement que le fixture `jpeg` converti n'y casse rien ; si `event-register-newcomer` échoue, **s'arrêter et signaler** le correctif à apporter dans ce fichier hors lot). Échec en masse : vérifier d'abord le SMTP du seed (`make db-seed`) avant de chercher dans le code.

- [ ] **Step 4: Commit** — `git add e2e && git commit -m "test: e2e du recadrage des images et du blocage de generation"`

---

### Task 13: e2e, doc, vérification

**Files:**
- Modify: `docs/v4/features/templates-badges.md`, `docs/v4/features/validation-profils.md`, `## Progression` de ce plan, journal de la spec (par l'orchestrateur)

- [ ] **Step 1: Documenter**
  - `templates-badges.md`, nouvelle section « Images de l'évènement » : lecture du cadre (liaison → bloc `image.source` → `w × h`, premier bloc en ordre de document, groupes parcourus), tolérance ± 2 %, résolution minimale 2 × cadre, WebP refusé pour logo/bannière, original conservé (`logoOriginal`/`bannerOriginal`), dimensions mémorisées, conformité calculée à la lecture, points bloqués (PDF, exports ZIP, planches, soumission de commande, impression sur place) avec code `EVENT_IMAGES_NONCOMPLIANT` (422), aperçu `?format=html` non bloqué (en-têtes `x-event-images*`), planches et commandes déjà générées non remises en cause. Corriger les passages obsolètes (« 512 × 512 conseillé »…).
  - `validation-profils.md`, nouvelle section « Photo d'identité » : ratio 7:9 (35 × 45 mm), minimum 210 × 270 px, chemins contrôlés (envoi compte, envoi admin d'évènement, route legacy, PATCH profil, PATCH snapshot d'inscription), pas de blocage rétroactif, règles affichées, motifs de rejet dédiés (créés par le seed ; en production le staff les ajoute dans les paramètres plateforme : le dire dans le guide).
  - Si `docs/v4/guide-utilisateur/` décrit l'envoi du logo ou de la photo, l'ajuster **ou le signaler** (hors liste exclusive).

- [ ] **Step 2: Vérification complète**

Run: `make lint && make typecheck && make test-coverage`
Expected: 0 avertissement lint, 0 erreur de type, tous les tests Vitest verts, seuils 100 % (lines, branches, functions, statements) respectés sur `src/lib/**` et `src/app/api/**`.

- [ ] **Step 3: e2e du lot**

Run: `make test-e2e FILE=e2e/event/images-badge.spec.ts && make test-e2e FILE=e2e/event/settings.spec.ts && make test-e2e FILE=e2e/public/account-profile.spec.ts && make test-e2e FILE=e2e/event/registrations-new.spec.ts`
Expected: PASS.

- [ ] **Step 4: Clôturer** : `## Progression` à jour (`[x]`, dates, notes), `git status` propre hors les fichiers du lot, vérifier qu'aucun fichier en lecture seule n'est modifié (`git diff --stat feat/retours-client-v3 -- prisma/schema.prisma src/lib/image-dimensions.ts src/lib/activity-labels.ts src/test/factories.ts e2e/helpers/db.ts`  → vide).

- [ ] **Step 5: Commit** — `git add docs docs/v4/plans && git commit -m "docs: images du badge et photo d'identite, plan 2a termine"`
