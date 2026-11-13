---
route: /org/[orgId]/events
title: Événements
audience: organisateur
access: org.events.list
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/events/EventArchiveActions.tsx
  - src/app/org/[orgId]/events/page.tsx
  - src/components/admin/CreateEventButton.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:0c5f34c0c6161b1597537019f667c31d09586bde5ee563ef1f0959000f314785
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste tous les évènements de votre organisation, archivés compris, du plus récent au plus ancien. La liste est paginée.

## Le tableau

Colonnes : **Titre** (avec son slug, l'identifiant d'URL publique, en dessous ; cliquer ouvre l'espace de l'évènement), **Période**, **Lieu**, **Inscriptions** (nombre d'inscriptions de l'évènement) et **Statut**.

Le statut peut être :
- **Inscriptions ouvertes** ;
- **Fermées** : l'évènement n'accepte pas de nouvelles inscriptions ;
- **Archivé** : la ligne est alors grisée.

S'il n'y a aucun évènement, l'écran affiche « Aucun événement. Créez votre premier événement. »

## Créer un évènement

:::permission org.events.create
Le bouton **Créer un événement** ouvre l'assistant de création. Il est désactivé, avec une explication, lorsque la création n'est pas possible : si votre abonnement est inactif (un lien « Voir mon abonnement » est alors proposé), ou si la création n'est pas disponible avec votre abonnement.
:::

## Actions sur une ligne

- **Configurer** : ouvre les paramètres de l'évènement. Ce lien n'apparaît que si vous avez le droit de modifier les paramètres de cet évènement.

:::permission org.events.archive
- **Archiver** : après confirmation (« Archiver cet événement ? »), l'évènement passe en statut Archivé.
- **Restaurer** : sur un évènement archivé, le remet en service sans confirmation.
:::
