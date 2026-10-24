# Cover (bannière) de l'évènement (v4 — chantier 26)

> Le *pourquoi* et les arbitrages sont dans la spec
> [`../specs/2026-10-24-26-v4-cover-evenement.md`](../specs/2026-10-24-26-v4-cover-evenement.md).
> Ce document décrit le *quoi* et le *comment* actuels.

## Principe

La bannière `Event.banner` (« cover ») est affichée en tête des pages de détail d'un
évènement. Sans bannière, chaque page reste identique : le composant ne rend rien.

## Composant

`src/components/event/EventCover.tsx` (composant serveur, sans `"use client"`) :

- `eventCoverUrl(banner)` : `/api/files/<clé>` (même forme que le logo) ; `null` pour une
  clé absente ou vide.
- `EventCover({ bannerUrl, title, variant })` :
  - `hero` : ratio 3:1, hauteur bornée à 288 px, coins et bordure des `Card` ;
  - `thumb` : ratio 16:9, sans bordure (la carte parente en porte déjà une).
  - L'image est recadrée (`object-cover`), jamais étirée ; le titre sert d'`alt`.
  - Le conteneur garde un fond neutre (`bg-slate-100`) et ses dimensions si le fichier a
    disparu du stockage : pas de mise en page cassée.

## Pages concernées

| Page | Variante |
|---|---|
| `/event/[eventId]` (tous les rôles, y compris le tableau de bord opérateur) | `hero`, au-dessus du titre |
| `/e/[slug]`, `/e/[slug]/register`, `/e/[slug]/success` (via `PublicEventLayout`) | `hero`, avant le contenu |
| `/account/registrations/[id]` | `hero`, en tête de page |
| `/account` (liste « Mes inscriptions ») | `thumb`, masquée sous 640 px |

`/e/[slug]` fermé (`ClosedView`) n'utilise pas le gabarit : pas de cover.

## Stockage et accès

La clé (`orgs/<orgId>/images/<uuid>.<ext>`) est posée par `POST /api/org/[orgId]/upload`
depuis `/event/[eventId]/settings` (JPEG / PNG / WebP, 5 Mo) et servie **publiquement** par
`GET /api/files/[...path]` (`Cache-Control: public, max-age=3600`). Aucun champ n'est ajouté
à `GET /api/public/events/[slug]`.
