---
route: /event/[eventId]/registrations
title: Inscriptions
audience: organisateur
access: event.read.detailed
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/registrations/page.tsx
  - src/components/event/RegistrationTable.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/StatusBadge.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:599a779a3981bf63ab3351813021d9745add5f8d3bcc78cb1df0431edc5a07c0
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les inscriptions de l'évènement pour les consulter et les modérer. Chaque ligne mène à la fiche de l'inscription.

## Rechercher et filtrer

- La zone de recherche (« Rechercher (nom, e-mail, document)… ») filtre la liste une fois la saisie terminée.
- Le sélecteur **Filtrer par statut** propose **Tous statuts**, **En attente**, **Approuvé** et **Rejeté**.
- Le bouton **Rafraîchir** recharge la liste.

Le statut, la recherche, la page et la taille de page sont conservés dans l'adresse de la page : un rechargement ou un lien partagé retrouve le même affichage.

:::permission registration.export
## Exporter

Le bouton **Exporter** télécharge les inscriptions de l'évènement au format CSV.
:::

:::permission registration.create
## Créer une inscription

Le bouton **Inscription** ouvre le formulaire d'inscription manuelle.
:::

## Le tableau

Colonnes : **Nom** (lien vers la fiche ; sur petit écran l'e-mail s'affiche sous le nom), **E-mail**, **Catégorie** et **Badge** (colonnes masquées sur petit écran), **Statut** et le lien **Détail**. La colonne Badge affiche **Imprimé** lorsque le badge a été imprimé, « — » sinon. S'il n'y a aucune inscription : « Aucune inscription. »

Sous le tableau, la pagination permet de changer de page et de choisir le nombre de lignes par page.
