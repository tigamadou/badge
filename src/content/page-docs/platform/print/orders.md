---
route: /platform/print/orders
title: Commandes d'impression
audience: staff
access: print.requests.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/orders/page.tsx
  - src/components/print/PrintRequestStatusBadge.tsx
  - src/components/staff/print/RequestList.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:10c6f2a40ef8d954f8fb7def07b0bd8648a949a96e7c56d33211b2e0e6ae980f
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les commandes d'impression demandées par les organisateurs : devis, paiements et production des badges. Les brouillons n'y apparaissent jamais. La liste est paginée.

## Les filtres

Les filtres s'appliquent au clic sur **Filtrer** :
- **Statut** : **Tous**, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée ou Annulée.
- **Organisation** : **Toutes**, ou une organisation qui a déjà passé commande.
- **Type** : **Tous**, **En amont** ou **Pendant l'évènement**.
- **Souhaitée du** et **au** : période de la date souhaitée (la journée de fin est incluse).

## Le tableau

Colonnes : **Référence** (un clic ouvre la commande ; une pastille rouge indique le nombre de messages non lus du fil), **Organisation**, **Évènement**, **Type**, **Badges** (le nombre de badges de la commande, ou la quantité estimée pour une commande sur place), **Total** (en FCFA), **Statut** et **Date souhaitée** (« — » si absente). S'il n'y a rien, l'écran affiche « Aucune commande » (« Aucune commande ne correspond à ces filtres. »).
