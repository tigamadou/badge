# Cover (bannière) de l'évènement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** afficher la bannière `Event.banner` (« cover ») en tête des pages de détail d'un
évènement — tableau de bord `/event/[eventId]`, pages publiques `/e/[slug]`, détail
d'inscription du compte — et en vignette dans la liste des inscriptions du compte. Sans
bannière, chaque page reste identique à aujourd'hui.

**Architecture :** un composant serveur unique `EventCover` (variantes `hero` 3:1 et `thumb`
16:9) et un petit helper `eventCoverUrl(banner)` qui construit l'URL
`/api/files/<clé>`, comme pour `logo`. Aucune nouvelle route ni nouveau stockage : la clé de
bannière (`orgs/<orgId>/images/<uuid>.<ext>`, posée par `POST /api/org/[orgId]/upload`) est
déjà servie publiquement par `GET /api/files/[...path]`. Les pages se contentent de
sélectionner `banner` et d'insérer le bloc.

**Tech Stack :** Next.js 16 App Router (Server Components), React 19, Tailwind CSS 4, Vitest 4
(rendu statique `renderToStaticMarkup`, environnement `node`).

**Spec :** [`docs/v4/specs/2026-10-24-26-v4-cover-evenement.md`](../specs/2026-10-24-26-v4-cover-evenement.md)
(coordination : [spec 22](../specs/2026-10-24-22-v4-lot-notifications-coordination.md))

**Branche :** `feat/cover-evenement` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Composant `EventCover` + helper `eventCoverUrl` (+ service public de la clé) | [x] | 2026-10-24 | EventCover + eventCoverUrl, tests unitaires et route fichiers verts |
| 2 | Cover sur les pages publiques (`PublicEventLayout`) | [x] | 2026-10-24 | cover dans PublicEventLayout, tests verts |
| 3 | Cover sur le tableau de bord `/event/[eventId]` (toutes variantes de rôle) | [x] | 2026-10-24 | cover sur les deux branches de /event/[eventId] ; navigateur à faire (lead) |
| 4 | Cover dans le compte participant (liste + détail d'inscription) | [x] | 2026-10-24 | vignette liste (>= sm) + hero détail ; navigateur à faire (lead) |
| 5 | Documentation | [x] | 2026-10-24 | fiche feature + README v4 |
| — | Vérification finale (lint, typecheck, test, navigateur 375 / 1280 px, avec et sans bannière) | [~] | 2026-10-24 | lint 0 erreur, typecheck OK, make test 1927/1927, test-coverage OK, e2e 38/38 ; navigateur 375/1280 px restant (lead) ; V2 couvert par test unitaire seulement |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style du fichier touché.
- **Server Components uniquement** : `EventCover` ne porte pas `"use client"` (pas de
  `onError`, pas d'état).
- **Périmètre de fichiers (spec 22)** : ce chantier possède `src/components/event/EventCover.tsx`
  et son test, et n'insère que le bloc cover dans les pages listées. Dans
  `src/app/account/registrations/[id]/page.tsx`, modifié aussi par le chantier 25 :
  **deux changements seulement** (ajout de `banner: true` dans le `select` de `event`, et
  l'insertion du bloc cover). Ne rien reformater d'autre : le second fusionné se rebase.
- **Pas de nouvelle dépendance, pas de changement de schéma Prisma, pas de modification
  du formulaire de paramètres** (le téléversement de la bannière existe déjà).
- **Image** : balise `<img>` native avec `// eslint-disable-next-line @next/next/no-img-element`,
  comme `src/components/ui/FileBox.tsx` et `DocumentPreview.tsx` (pas de `next/image` : il
  impose des dimensions et passerait par l'optimiseur pour un simple bandeau).
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un seul fichier de test : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`
    (le `Makefile` n'a pas de cible « un fichier ») ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** (et `files-access.test.ts` vide la table `user`) :
  `make db-seed` avant toute vérification navigateur.
- **Vérification navigateur** avec le navigateur intégré, à 375 × 812 puis 1280 px, **avec
  et sans bannière**. Critère générique de non-débordement :
  `document.documentElement.scrollWidth === innerWidth`.
- **Données de recette** : compte `admin@badge.local` / `123456` (staff, accède à
  `/event/[eventId]` et à ses paramètres) ; compte `participant@badge.local` / `123456`. Pour
  poser une bannière : `/event/[eventId]/settings` → « Bannière » → téléverser une image
  JPEG/PNG/WebP → enregistrer. Si le participant n'a aucune inscription, en créer une via
  `/e/[slug]/register`.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Une étape « commit » de ce
  plan n'est pas une demande. Message conventional commit en français ASCII, sans trailer
  de co-auteur IA (par ex. `feat(event): affiche la cover de l'evenement`).
- **Aucune étape de déploiement ni de SSH.** Le plan s'arrête à `development` vert en local.

## Points de vigilance de revue

| # | Cas impliqué par la spec, non testé par elle | Test | Task |
|---|---|---|---|
| V1 | Image très haute ou très étroite (portrait, 100 × 2000 px) : le bandeau ne doit ni s'étirer ni déformer l'image. | Le conteneur porte `aspect-[3/1]` (ou `aspect-video`) + `overflow-hidden`, l'`<img>` porte `h-full w-full object-cover` : la hauteur dépend du ratio, jamais de l'image. | 1 |
| V2 | Fichier supprimé du stockage alors que `Event.banner` le référence encore (la route renvoie 404) : pas de bloc qui s'effondre ni de mise en page cassée. | Le conteneur porte un fond neutre `bg-slate-100` et garde ses dimensions ; l'`alt` (titre) s'affiche à la place de l'image. Test : classes de fond et de ratio présentes sur le conteneur, `alt` non vide. | 1 |
| V3 | Clé vide `""` (chaîne vide enregistrée au lieu de `null`) : ne doit pas produire `src="/api/files/"`. | `eventCoverUrl("")` → `null` et `EventCover` avec `bannerUrl=""` → rendu vide. | 1 |
| V4 | Titre contenant des caractères spéciaux (`"`, `&`, `<`) dans l'`alt`. | Rendu avec `Salon "Tech" & <Co>` → `alt="Salon &quot;Tech&quot; &amp; &lt;Co&gt;"`. | 1 |
| V5 | La page publique ne doit exposer **que** la bannière, pas un fichier privé. | Test d'intégration de la route de fichiers : une clé `orgs/<id>/images/x.png` est servie **sans session** (200, `Cache-Control: public, max-age=3600`) ; le test existant prouve déjà qu'une clé `profile/<id>/documents/...` reste refusée (403). Aucun champ ajouté à la réponse JSON de `GET /api/public/events/[slug]`. | 1 |

## Structure des fichiers

| Fichier | Action | Task |
|---|---|---|
| `src/components/event/EventCover.tsx` | Créer | 1 |
| `src/components/event/__tests__/EventCover.test.tsx` | Créer | 1 |
| `src/app/api/__tests__/files-access.test.ts` | Modifier (1 test ajouté) | 1 |
| `src/components/public/PublicEventLayout.tsx` | Modifier | 2 |
| `src/components/public/__tests__/PublicEventLayout.test.tsx` | Créer | 2 |
| `src/app/event/[eventId]/page.tsx` | Modifier | 3 |
| `src/app/account/page.tsx` | Modifier (liste des inscriptions) | 4 |
| `src/app/account/registrations/[id]/page.tsx` | Modifier (bloc cover uniquement) | 4 |
| `docs/v4/features/cover-evenement.md` | Créer | 5 |
| `docs/v4/README.md` | Modifier | 5 |

Pages couvertes (lecture de `src/app/`, 2026-10-24) :

- `/event/[eventId]` : **une seule page** pour tous les rôles event. Le layout choisit le
  shell (`EventShell`, `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell`) ; la page
  a deux rendus : la branche `role === "OPERATOR"` (tableau de bord opérateur) et le rendu
  complet (ADMIN, PRINTER, VIEWER, staff). La cover va dans **les deux branches**.
- `/e/[slug]`, `/e/[slug]/register`, `/e/[slug]/success` : les trois passent par
  `PublicEventLayout` avec la ligne `Event` complète (`banner` déjà présent). Insérer la cover
  dans le gabarit l'affiche donc sur les trois, ce qui garde un en-tête public cohérent.
  `/e/[slug]` fermé (`ClosedView`) n'utilise pas le gabarit : pas de cover.
- `/account` (`src/app/account/page.tsx`) : la liste « Mes inscriptions » (vignette).
- `/account/registrations/[id]` : détail d'inscription (bandeau).
- Hors périmètre : `/platform` (pas de page de détail d'évènement, cf. spec), sous-pages
  `/event/[eventId]/*`.

---

## Task 1 — Composant `EventCover` et helper `eventCoverUrl`

**Fichiers :**
- Créer : `src/components/event/EventCover.tsx`, `src/components/event/__tests__/EventCover.test.tsx`
- Modifier : `src/app/api/__tests__/files-access.test.ts`

**Interfaces :**

```ts
// src/components/event/EventCover.tsx (composant serveur, sans "use client")
export function eventCoverUrl(banner: string | null | undefined): string | null;
// "" / null / undefined -> null ; sinon `/api/files/${banner}` (même forme que le logo)

export function EventCover(props: {
  bannerUrl: string | null | undefined;
  title: string;            // sert d'alt
  variant: "hero" | "thumb";
}): JSX.Element | null;
```

Rendu attendu :
- `bannerUrl` falsy → `null` (aucun élément, pas de bloc vide).
- `hero` : `<div class="aspect-[3/1] max-h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">`
  (coins et bordure des `Card`, hauteur bornée à 288 px) contenant
  `<img src={bannerUrl} alt={title} class="h-full w-full object-cover" />`.
- `thumb` : même structure avec `aspect-video w-full overflow-hidden rounded-lg bg-slate-100`
  (pas de bordure, la carte en porte déjà une). La largeur est fixée par le parent.

- [ ] Écrire `EventCover.test.tsx` (`renderToStaticMarkup`, comme `src/components/ui/__tests__/FileBox.test.tsx`) :
  - `eventCoverUrl("orgs/o1/images/a.png")` → `"/api/files/orgs/o1/images/a.png"` ;
    `eventCoverUrl(null)`, `eventCoverUrl(undefined)`, `eventCoverUrl("")` → `null` (V3).
  - `bannerUrl={null}` et `bannerUrl=""` → `renderToStaticMarkup(...) === ""` (V3).
  - `hero` : le HTML contient `src="/api/files/k.png"`, `alt="Forum 2026"`, `aspect-[3/1]`,
    `max-h-72`, `object-cover`, `overflow-hidden`, `bg-slate-100`, `rounded-xl` (V1, V2).
  - `thumb` : contient `aspect-video`, `object-cover`, `bg-slate-100` et **pas** `aspect-[3/1]`.
  - `title='Salon "Tech" & <Co>'` → contient `alt="Salon &quot;Tech&quot; &amp; &lt;Co&gt;"` (V4).
- [ ] Ajouter dans `files-access.test.ts` le test « sert une bannière d'évènement sans session » :
  `uploadFile("orgs/pub-org/images/cover.png", Buffer.from("img"), "image/png")`, session
  `null`, `GET` → `status === 200` et `res.headers.get("Cache-Control") === "public, max-age=3600"` (V5).
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/event/__tests__/EventCover.test.tsx`
  → échec attendu : module `../EventCover` introuvable. Le test de route passe déjà (il
  documente un comportement existant ; s'il échoue, **arrêter et remonter** : la bannière
  ne serait pas servie publiquement).
- [ ] Implémenter `EventCover.tsx` selon les interfaces ci-dessus.
- [ ] Relancer les deux fichiers de test → verts.
- [ ] `make lint && make typecheck`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur**.

**Critères d'acceptation :** tests verts ; aucun `"use client"` dans `EventCover.tsx`.

## Task 2 — Cover sur les pages publiques (`PublicEventLayout`)

**Fichiers :**
- Modifier : `src/components/public/PublicEventLayout.tsx`
- Créer : `src/components/public/__tests__/PublicEventLayout.test.tsx`

**Interfaces :**

```ts
// Props.event gagne un champ optionnel ; les appelants passent déjà la ligne Event complète.
event: { title: string; date: Date | string; endDate?: Date | string | null;
         location: string; logo?: string | null; banner?: string | null };
```

Emplacement : premier enfant de `<main>`, avant `children`, enveloppé dans
`<div className="mb-6">` uniquement quand une bannière existe (pas de marge orpheline) :
`<EventCover bannerUrl={eventCoverUrl(event.banner)} title={event.title} variant="hero" />`.
L'en-tête marine (logo + titre) reste inchangé.

- [ ] Écrire `PublicEventLayout.test.tsx` (`logo: null` pour ne pas rendre `next/image`) :
  - avec `banner: "orgs/o1/images/c.png"` → le HTML contient `src="/api/files/orgs/o1/images/c.png"`
    et `aspect-[3/1]`, et l'image précède le contenu enfant (`html.indexOf("/api/files/") < html.indexOf("ENFANT")`
    avec un enfant `<p>ENFANT</p>`).
  - sans `banner` (champ absent) et avec `banner: null` → le HTML ne contient ni `aspect-[3/1]`
    ni `/api/files/` ; il contient toujours `ENFANT` et le titre.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/public/__tests__/PublicEventLayout.test.tsx`
  → échec attendu sur le cas « avec bannière » (aucune image rendue).
- [ ] Implémenter : type `banner?: string | null`, import de `EventCover` / `eventCoverUrl`,
  insertion du bloc. Ne pas toucher aux appelants (`/e/[slug]`, `register`, `success`) : ils
  passent déjà `event` avec `banner` ; `make typecheck` le confirme.
- [ ] Relancer → vert. `make lint && make typecheck`.
- [ ] Vérification navigateur (`make db-seed` si `make test` a tourné) : `/e/<slug>`,
  `/e/<slug>/register` (connecté participant) à 375 et 1280 px, avec et sans bannière ;
  pas de débordement horizontal, pas de bloc vide sans bannière.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur**.

**Critères d'acceptation :** cover en tête des trois pages publiques quand elle existe ;
réponse JSON de `GET /api/public/events/[slug]` inchangée (V5).

## Task 3 — Cover sur le tableau de bord `/event/[eventId]`

**Fichiers :**
- Modifier : `src/app/event/[eventId]/page.tsx`

**Interfaces :** `select` de `prisma.event.findUnique` + `banner: true` ;
`const coverUrl = eventCoverUrl(event.banner);` calculé une fois après le contrôle d'accès.

Emplacement :
- branche `OPERATOR` : premier enfant du `<div className="max-w-xl space-y-6">`, avant le `<h1>` ;
- rendu complet : premier enfant du `<div className="space-y-6">`, avant le bloc titre.

Le `space-y-6` du parent espace déjà le bloc ; `EventCover` renvoie `null` sans bannière, donc
la mise en page est inchangée.

- [ ] Pas de test unitaire de page (page asynchrone avec session et Prisma, aucun précédent
  dans le dépôt) : la logique est couverte par la Task 1, la preuve d'intégration est la
  vérification navigateur ci-dessous.
- [ ] Implémenter les deux insertions.
- [ ] `make lint && make typecheck && make test`, puis `make db-seed`.
- [ ] Vérification navigateur : `/event/<id>` en `admin@badge.local`, 375 et 1280 px, avec puis
  sans bannière (bouton « Retirer » dans les paramètres). Si un compte OPERATOR existe dans
  le seed, vérifier aussi son tableau de bord ; sinon le noter dans la Progression.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur**.

**Critères d'acceptation :** cover au-dessus du titre pour tous les rôles event ; sans
bannière, page identique à `development`.

## Task 4 — Cover dans le compte participant

**Fichiers :**
- Modifier : `src/app/account/page.tsx` (liste « Mes inscriptions »)
- Modifier : `src/app/account/registrations/[id]/page.tsx` (bloc cover uniquement, cf. contraintes)

**Interfaces :**
- Les deux `select` de `event` gagnent `banner: true`.
- Liste : dans chaque carte (`<Link className="flex items-center gap-4 ...">`), avant la
  case de date, `{r.event.banner && <div className="hidden w-28 flex-none sm:block"><EventCover bannerUrl={eventCoverUrl(r.event.banner)} title={r.event.title} variant="thumb" /></div>}`.
  **Choix :** la vignette est masquée sous `sm` (640 px). À 375 px, la carte porte déjà la
  case de date, le titre, le statut et le chevron ; une vignette de plus réduirait le titre à
  quelques caractères par ligne. Le participant voit la cover en ouvrant le détail.
- Détail : premier enfant du `<div className="space-y-6">`, avant le bloc « Retour » / titre :
  `<EventCover bannerUrl={eventCoverUrl(registration.event.banner)} title={registration.event.title} variant="hero" />`.

- [ ] Pas de test unitaire de page (même raison qu'en Task 3).
- [ ] Implémenter les deux pages (diff minimal sur la page de détail : une ligne de `select`,
  un import, un élément JSX).
- [ ] `make lint && make typecheck && make test`, puis `make db-seed`.
- [ ] Vérification navigateur en `participant@badge.local` : `/account` et
  `/account/registrations/<id>`, à 375 et 1280 px, avec et sans bannière. À 1280 px, la
  vignette 16:9 est alignée sur la carte ; à 375 px, elle est absente et la carte est
  identique à `development`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur**.

**Critères d'acceptation :** vignette dans chaque carte (≥ 640 px) et bandeau sur le détail
quand la bannière existe ; rien sinon.

## Task 5 — Documentation

**Fichiers :**
- Créer : `docs/v4/features/cover-evenement.md`
- Modifier : `docs/v4/README.md`

- [ ] Fiche feature (style des fiches existantes, p. ex. `validation-profils.md`) : rôle de la
  cover, pages où elle s'affiche (liste de la section *Structure des fichiers*), variantes
  `hero` 3:1 / `thumb` 16:9, vignette masquée sous 640 px, URL via `/api/files/<clé>` (clé
  `orgs/<orgId>/images/...`, publique), comportement si le fichier a disparu (fond neutre +
  texte alternatif), formats acceptés (JPEG/PNG/WebP, 5 Mo, téléversement dans
  `/event/[eventId]/settings`).
- [ ] `docs/v4/README.md` : ligne sous « Plans à implémenter » (spec 26 · plan · feature) et
  ligne dans « État d'avancement », dans le format des lignes voisines.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur**.

## Vérification finale

- [ ] `make lint` (0 erreur, 0 avertissement nouveau), `make typecheck`, `make test` (portes de
  couverture 100 % `src/lib` et API inchangées : ce chantier n'ajoute pas de code dans ces
  dossiers).
- [ ] `make db-seed`, puis navigateur à **375 px et 1280 px**, **avec et sans bannière**, sur :
  `/event/<id>`, `/e/<slug>`, `/e/<slug>/register`, `/account`, `/account/registrations/<id>`.
  Critères : image visible et non déformée, pas de débordement horizontal, pas de bloc vide
  sans bannière.
- [ ] Cas V2 (fichier disparu) : pas de vérification manuelle, car supprimer un fichier de
  `uploads/` demande l'accord de l'utilisateur. Le test unitaire V2 fait foi ; le noter dans
  la Progression.
- [ ] Mettre à jour la Progression (dates, notes).

## Self-review

- **Couverture de la spec** : composant unique `EventCover({ bannerUrl, title, variant })`
  (Task 1) ; ratio 3:1, `object-cover`, coins des `Card`, hauteur bornée (Task 1) ; vignette
  16:9 (Tasks 1, 4) ; `alt` = titre (Task 1) ; même mécanisme d'URL que `logo` (Task 1, V5) ;
  pages admin, publique, compte (Tasks 2-4) ; rien sans bannière (Tasks 1-4) ; 375 / 1280 px
  (vérification finale) ; test avec et sans bannière (Tasks 1, 2) ; formulaire non modifié.
- **Écarts assumés** : cover aussi sur `/e/[slug]/register` et `/success` (même gabarit) ;
  vignette masquée sous 640 px ; helper `eventCoverUrl` exporté par le composant (4 appels).
- **Cohérence des noms** : `EventCover`, `eventCoverUrl`, `variant: "hero" | "thumb"`
  identiques dans toutes les tasks.
