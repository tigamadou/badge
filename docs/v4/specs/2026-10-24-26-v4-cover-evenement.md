# Spec v4 — Afficher la cover (bannière) de l'évènement

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : évolution d'affichage
> **Périmètre** : v4 — pages de détail d'un évènement (admin, staff, compte participant, page publique)
> **Plan** : [`plans/2026-10-24-cover-evenement.md`](../plans/2026-10-24-cover-evenement.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md)
> **Source** : `Todo.md` du 2026-10-24, point 3

## Contexte

Le modèle `Event` porte un champ `banner` (chemin de fichier, comme `logo`), téléversé
depuis `/event/[eventId]/settings` et utilisé par les templates de badge
(`event.bannerDataUrl`). Il **n'est affiché nulle part** dans l'interface. L'utilisateur
appelle « cover » cette bannière (validé le 2026-10-24).

## Objectif

Sur la page d'un évènement, afficher la cover **si elle existe**, que ce soit dans
l'administration ou dans le compte participant.

## Pages concernées

| Espace | Page | Emplacement |
|---|---|---|
| Admin évènement | `/event/[eventId]` (tableau de bord, tous rôles event) | bandeau en tête de page, au-dessus du titre |
| Compte participant | `/account/registrations/[id]` (détail d'inscription) et la liste des inscriptions (vignette) | bandeau en tête ; vignette dans chaque carte de la liste |
| Public | `/e/[slug]` (`PublicEventLayout`) — **choix de conception** : c'est la page que le participant voit avant de s'inscrire | bandeau en tête |

L'espace `/platform` n'a pas de page de détail d'évènement (seulement la liste
`/platform/organizations/[orgId]/events`) : il n'est pas concerné. Le staff qui ouvre un
évènement arrive sur `/event/[eventId]` et y voit la cover.

Le constructeur confirme la liste exacte des pages en lisant `src/app/`.

## Conception

- Un composant serveur unique `src/components/event/EventCover.tsx` :
  `EventCover({ bannerUrl, title, variant: "hero" | "thumb" })`. Rien n'est rendu si
  `bannerUrl` est nul.
- `hero` : pleine largeur du contenu, ratio **3:1** (`aspect-[3/1]`), `object-cover`,
  coins arrondis comme les `Card`, hauteur bornée sur mobile. `thumb` : vignette 16:9 dans
  les cartes.
- `alt` = titre de l'évènement.
- L'URL de l'image est résolue avec le **même mécanisme que `logo`** (lecture via
  `storage.ts` et la route de service de fichiers existante) ; aucun nouveau mécanisme de
  stockage. La page publique ne doit exposer que la bannière, pas d'autre fichier privé.
- Aucune modification du formulaire de paramètres (le téléversement existe déjà).

## Critères d'acceptation

- Un évènement avec bannière l'affiche sur chacune des pages listées ; sans bannière, la
  mise en page est identique à aujourd'hui (pas de bloc vide).
- Rendu correct à 375 px et 1280 px.
- Test unitaire du composant (avec et sans bannière) ; vérification navigateur.
