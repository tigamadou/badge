# Documentation des pages — Badge v4

> Spec : [`specs/2026-11-13-40-v4-documentation-des-pages.md`](../specs/2026-11-13-40-v4-documentation-des-pages.md) ·
> Plan : [`plans/2026-11-13-4a-documentation-des-pages.md`](../plans/2026-11-13-4a-documentation-des-pages.md) ·
> Catalogue des permissions : [`specs/2026-11-13-37-v4-roles-et-permissions.md`](../specs/2026-11-13-37-v4-roles-et-permissions.md).

## Objectif et public

Chaque page des espaces connectés (`/platform`, `/org/[orgId]`, `/event/[eventId]`, `/account`) a une
documentation qui explique à quoi sert l'écran et ce que fait chaque option. Public : les organisateurs et le
staff. Elle est écrite et tenue à jour **par les agents IA qui modifient le code de la page**, dans le même
changement, et relue en PR comme du code. Aucun appel à l'API Anthropic, aucune commande de régénération, aucun hook.

## Format d'une doc

Un fichier Markdown par page : `src/content/page-docs/<espace>/<chemin>.md`.

```yaml
---
route: /org/[orgId]/events/new
title: Créer un évènement
audience: organisateur          # organisateur | staff | participant
access: org.events.create       # facultatif : permission exigée par la garde de la page
sources:                        # posé par l'outil
  - src/app/org/[orgId]/events/new/page.tsx
sourceHash: sha256:…            # posé par l'outil
updatedAt: 2026-11-20           # posé par l'outil
---
```

- **`access`** (extension du lot) : sert à filtrer la liste de la section Documentation et l'API ; sans lui, la
  doc est listée pour tout utilisateur de l'espace qui dispose d'au moins une permission sur la cible.
- **Corps** : « À quoi sert cet écran », une section par bloc de l'écran, « Questions fréquentes » si utile.
- **Blocs liés à une permission** : `:::permission <clé>` … `:::` autour d'une section qui n'a de sens qu'avec
  cette permission. La clé appartient au catalogue et a **la portée de l'espace** : `/platform` (y compris
  `/platform/organizations/[orgId]/…`) → PLATFORM, `/org` → ORG, `/event` → EVENT, `/account` → PARTICIPANT.
  Pas de blocs imbriqués.

### Correspondance route → fichier

Les segments dynamiques sont omis du nom ; l'identifiant d'une doc est le chemin sans `src/content/page-docs/` ni `.md`.

| Route | Identifiant |
|---|---|
| `/org/[orgId]/events/new` | `org/events/new` |
| `/org/[orgId]`, `/platform`, `/account` | `org/index`, `platform/index`, `account/index` |
| dernier segment dynamique (`/platform/users/[userId]`) | `platform/users/detail` |
| collision restante (`/event/[eventId]/print/[requestId]/onsite` face à `/event/[eventId]/print/onsite`) | `event/print/requestId/onsite` (la route sans segment dynamique garde le nom court) |

`make docs-check` indique le chemin attendu pour chaque page sans doc.

## Outil hors ligne `scripts/page-docs`

Pas d'API externe ni de réseau ; l'outil ne rédige rien, il vérifie, tamponne et génère.

| Module | Rôle |
|---|---|
| `paths.ts` | découverte des `page.tsx` (hors `…/docs/**`), identifiants, désambiguïsation |
| `sources.ts` | sources d'une page : la page et ses imports (`@/` ou relatifs) sous `src/app/**` et `src/components/**`, 3 niveaux |
| `hash.ts` | empreinte sha256 des sources triées (fins de ligne normalisées ; fichier absent = « absent ») |
| `format.ts` | lecture/écriture du frontmatter, validation des blocs `:::permission` |
| `check.ts`, `stamp.ts`, `manifest.ts`, `cli.ts` | vérification, tampon, modules générés, ligne de commande |

Modules générés (ne pas modifier à la main) :

- `src/content/page-docs/manifest.generated.ts` : `PAGE_DOCS` avec le corps (serveur uniquement) ;
- `src/content/page-docs/index.generated.ts` : `PAGE_DOC_INDEX` **sans corps**, sûr côté client.

La doc est donc **embarquée au build** (compatible `output: "standalone"`) : aucune lecture disque à l'exécution.

### Commandes

- `make docs-check` : liste les docs **manquantes**, **obsolètes** (empreinte des sources différente),
  **orphelines**, les erreurs de **format** (frontmatter incomplet, `audience` invalide, `route` différente du
  fichier, clé `access` ou de bloc hors catalogue ou de mauvaise portée, bloc non fermé, imbriqué ou orphelin,
  avec la ligne) et les **manifestes** à régénérer ; code de sortie non nul au moindre problème.
- `make docs-stamp PAGES="…"` : recalcule `sources`, `sourceHash`, `updatedAt` des docs indiquées et réécrit les
  manifestes. Sélecteurs : identifiant (`org/events/new`), route (`/org/[orgId]`), espace (`org`) ou `all`.
  L'outil ne crée aucun fichier : l'agent écrit le `.md` (`route`, `title`, `audience`), puis tamponne.
  `updatedAt` n'est modifié que si les sources ou le contenu publié ont changé : deux tampons consécutifs ne
  produisent aucun diff.
- **Intégration** : `make lint` exécute `yarn lint` puis `docs-check` ; `make ci` et `make test-all` en héritent.

## Interface

- **Bouton « ? »** dans l'en-tête des quatre gabarits d'espace, à côté de la cloche ; il n'apparaît que si la page
  courante a une doc (appariement côté client sur l'index sans corps). Il ouvre un **panneau latéral** (plein
  écran sous 640 px) : titre, corps, « Mise à jour le … », lien « Toute la documentation ». Focus piégé, `Échap`
  ferme, le focus revient au bouton.
- **`GET /api/page-docs?path=<chemin>`** : `200 { id, title, updatedAt, audience, html, docsHref }`, `400` si
  `path` manque ou dépasse 300 caractères, `401` non connecté ou compte archivé, `403` compte bloqué, `404
  { error: "NOT_FOUND" }` s'il n'y a pas de doc **ou** si l'accès est refusé (même réponse). Lecture seule,
  `Cache-Control: private, no-store`.
- **Section Documentation** de chaque espace : `…/docs` (liste groupée par section, filtrée par `access`) et
  `…/docs/[...slug]` (lecture pleine page ; `404` si la doc est absente ou refusée).
- **Rendu Markdown** côté serveur (`markdown-it`, `html: false`) : pas de HTML brut, liens limités à
  `http`, `https`, `mailto` et aux liens relatifs.

### Filtrage par permission

Fait **côté serveur** (`src/lib/page-docs/`) : la cible de permissions est déduite de la route (plateforme,
organisation, évènement dont l'organisation est lue en base, participant) ; un bloc dont l'utilisateur n'a pas
la permission est retiré avant le rendu, il n'apparaît donc pas dans la réponse. Un bloc dont la clé n'a pas la
portée évaluée est conservé avec la mention « Réservé aux utilisateurs disposant de la permission … ». Un bloc
mal formé ne casse jamais le rendu (texte conservé, marqueurs retirés).

## Consigne aux agents

La règle (quand mettre à jour, comment, format, rédaction) est dans la section « Documentation des pages » de
[`CLAUDE.md`](../../../CLAUDE.md) (que `AGENTS.md` reprend, c'est un lien symbolique) ; le skill `chantier` et
son modèle d'orchestration l'appliquent à chaque lot.

## Non-objectifs

Pages publiques (`/e/…`, marketing, inscription) ; recherche plein texte ; traduction ; édition de la doc depuis
l'interface ; génération à l'exécution ; génération par appel à l'API Anthropic ; commande de régénération
automatique.
