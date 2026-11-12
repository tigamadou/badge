# Spec v4 — Documentation contextuelle des pages, tenue à jour par les agents (spec 40)

> **Statut** : validée — 2026-11-13
> **Type** : nouvelle fonctionnalité + outillage de développement
> **Périmètre** : v4 — espaces connectés (`/platform`, `/org`, `/event`, `/account`), outillage
> `scripts/`, `Makefile`, consignes des agents IA
> **Source** : `Todo.md` du 2026-11-12 (item 5) + échanges du 2026-11-13
> **Coordination** : [`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](2026-11-13-36-v4-chantier-roles-docs-coordination.md) — lot 4a

## Contexte

Aucune aide n'existe dans l'application : un organisateur qui découvre un écran de réglages
doit deviner le rôle de chaque option, et le staff se forme sur le tas. Il y a 79 pages dans
les espaces connectés (plateforme 37, organisation 14, évènement 23, compte 5). Les
changements de code sont faits en grande partie par des agents IA, y compris en exécution
automatisée.

## Objectif

1. Sur chaque page d'un espace connecté, un bouton **« ? »** ouvre la documentation **de
   cette page** dans un panneau latéral, sans quitter l'écran : à quoi sert l'écran, chaque
   option et chaque paramètre expliqués.
2. Une section **Documentation** par espace, qui liste les pages documentées.
3. La documentation est **mise à jour dans le même changement** que le code de la page,
   par l'agent IA qui fait ce changement, et relue dans la PR comme du code.

## Décisions (validées par l'utilisateur)

1. **Public** : les organisateurs (pour comprendre chaque option d'un écran) et les admins
   (staff) (2026-11-13).
2. **Approche 1** (2026-11-13) : un fichier de doc par page, versionné et relu dans la PR.
3. **Pas d'appel à l'API Anthropic ni de commande de régénération** (2026-11-13) : ce sont
   les **agents IA** qui écrivent et mettent à jour la doc liée à leurs changements, sur
   **consigne** inscrite dans les fichiers d'instructions du projet (`CLAUDE.md`,
   `AGENTS.md`).

## Approches envisagées

| Approche | Verdict |
|---|---|
| **1. Doc par page, écrite et tenue à jour par l'agent qui modifie la page** | **Retenue** : vraie explication d'écran, relue en PR, sans clé ni coût d'API. |
| 2. Doc assemblée depuis des textes d'aide annotés dans les composants | Écartée : liste de champs sans explication d'ensemble, annotation manuelle de tous les formulaires. |
| 3. Génération à la volée au clic | Écartée : coût et latence à chaque ouverture, aucune relecture, risque d'erreur montrée au client. |

## Conception

### Contenu (arbitrages de l'agent)

- Un fichier Markdown par page : `src/content/page-docs/<espace>/<chemin>.md`, où
  `<chemin>` reprend le chemin de la route (`/org/[orgId]/events/new` →
  `org/events/new.md`, les segments dynamiques sont omis du nom de fichier mais présents
  dans `route`).
- En-tête (frontmatter) :
  ```yaml
  route: /org/[orgId]/events/new
  title: Créer un évènement
  audience: organisateur        # organisateur | staff | participant
  sources:                      # fichiers décrits, calculés par l'outil
    - src/app/org/[orgId]/events/new/page.tsx
    - src/components/admin/EventForm.tsx
  sourceHash: sha256:…          # empreinte du contenu des sources, posée par l'outil
  updatedAt: 2026-11-20
  ```
- Corps : « À quoi sert cet écran », puis une section par bloc de l'écran, chaque option
  expliquée (effet, valeur par défaut, contraintes, conséquences), puis « Questions
  fréquentes » si utile. Français, accents, vouvoiement, ton du guide utilisateur existant.
- **Blocs liés à une permission** : `:::permission <clé>` … `:::` autour d'une section qui
  n'a de sens qu'avec cette permission (catalogue de la spec 37). Le panneau masque les
  blocs dont l'utilisateur n'a pas la permission sur la page courante.
- Un module généré `src/content/page-docs/manifest.generated.ts` (route → titre, audience,
  corps) est importé par l'application : la doc est **embarquée au build** (compatible
  `output: "standalone"`), sans lecture disque à l'exécution.
- La doc est écrite à partir du code de la page et de ses composants : n'expliquer que ce
  que l'écran montre, ne rien inventer, utiliser les libellés de l'interface, ne jamais
  citer de secret ni de donnée personnelle.

### Outil de vérification (hors ligne, sans API) *(arbitrage de l'agent)*

Filet de sécurité contre une doc oubliée ; il ne rédige rien.

- `scripts/page-docs/` (TypeScript) :
  - **découverte** des `page.tsx` des quatre espaces ;
  - **sources** d'une page : la page, puis ses imports relatifs ou `@/` situés dans
    `src/app/**` et `src/components/**`, jusqu'à 3 niveaux ;
  - **empreinte** sha256 du contenu concaténé des sources, triées ;
  - **manifeste** : réécriture de `manifest.generated.ts`.
- `make docs-check` : liste les docs **obsolètes** (empreinte différente), **manquantes**
  (page sans doc) et **orphelines** (doc sans page), et vérifie le format (frontmatter
  complet, clés `:::permission` présentes dans le catalogue, blocs fermés) ; code de sortie
  non nul s'il y a un problème. Appelée par `make lint`, donc par `make ci`.
- `make docs-stamp PAGES=…` : après que l'agent a mis à jour le texte, recalcule `sources`,
  `sourceHash` et `updatedAt` des docs indiquées et réécrit le manifeste.

### Interface

- **Bouton « ? »** dans l'en-tête de `StaffShell`, `OrgShell`, `EventShell` et du layout
  `/account`, à côté de la cloche. Il n'apparaît que si la page courante a une doc. Il
  ouvre un **panneau latéral** (plein écran en mobile) : titre, corps rendu, date de mise à
  jour, lien « Toute la documentation ».
- **Section Documentation** : entrée de menu « Documentation » dans chaque espace et pages
  `/platform/docs`, `/org/[orgId]/docs`, `/event/[eventId]/docs`, `/account/docs` : liste des
  pages documentées de l'espace (filtrée par les permissions d'accès de chaque page), et
  lecture d'une doc en pleine page (`…/docs/[...slug]`).
- Rendu Markdown côté serveur avec une bibliothèque légère (choix du constructeur), sans
  HTML brut autorisé.
- Accessible uniquement aux utilisateurs connectés (les espaces le sont déjà).

### Consignes pour les agents IA

- **`CLAUDE.md`**, nouvelle section « Documentation des pages », et **`AGENTS.md`** (qui
  renvoie à `CLAUDE.md`, avec un rappel explicite de la règle) :
  - toute modification d'une page d'un espace connecté ou d'un composant qu'elle utilise
    oblige à **mettre à jour sa doc** (`src/content/page-docs/…`) dans le même
    changement : options ajoutées, retirées ou modifiées, comportement changé ;
  - une nouvelle page → une nouvelle doc ; une page supprimée → sa doc supprimée ;
  - règles de rédaction (public, structure, blocs `:::permission`, rien d'inventé, pas de
    secret) ;
  - puis `make docs-stamp PAGES=…` et `make docs-check` vert avant tout commit ; ne jamais
    toucher à la main `sourceHash` ni au manifeste ;
  - une doc qui ne change pas de sens (refactor sans effet visible) se re-tamponne
    simplement.
- **`.claude/CLAUDE.md`** (template générique) : règle générique « tenir à jour la
  documentation utilisateur liée à ses changements, selon la consigne du projet ».
- **Skill `chantier`** et `orchestrator-template.md` : la tâche finale « e2e, doc,
  vérification » de chaque plan inclut la mise à jour des docs des pages du lot ; la fusion
  vérifie `make docs-check`.

### Mise en place initiale

La rédaction des 79 docs se fait **après la fusion des lots du chantier** (pages et
permissions définitives), en vague finale, par des sous-agents de l'orchestrateur (un par
espace) ; elles sont relues dans la PR.

## Non-objectifs

- Pages publiques (`/e/…`, marketing, inscription) ; recherche plein texte ; traduction ;
  édition de la doc depuis l'interface ; génération à l'exécution ; génération par appel
  à l'API Anthropic ; commande de régénération automatique.

## Anti-objectifs

- Une doc qui décrit une option absente de l'écran ou en invente une.
- Une doc qui expose une information sensible (secret, donnée personnelle d'exemple).
- Un `make lint` vert alors qu'une page modifiée a une doc obsolète.

## Fichiers

Socle : point d'insertion du bouton dans les gabarits et entrées de menu (voir coordination).
Lot 4a : `scripts/page-docs/**`, `src/content/page-docs/**`, `src/components/page-docs/**`,
pages `…/docs/**` des quatre espaces, cibles `Makefile` `docs-check` / `docs-stamp` et ajout
à `lint`, `package.json` (bibliothèque de rendu Markdown), `CLAUDE.md`, `AGENTS.md`,
`.claude/CLAUDE.md`, `.claude/skills/chantier/**`, `docs/v4/features/documentation-pages.md`.

## Journal

- 2026-11-13 — L'utilisateur retire l'appel à l'API et la commande de régénération : la
  doc est tenue à jour par les agents IA sur consigne (`CLAUDE.md`, `AGENTS.md`). Arbitrage
  de l'agent : garder une vérification hors ligne (`docs-check`, `docs-stamp`) comme filet
  de sécurité, sans hook.
