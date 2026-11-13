---
route: /org/[orgId]/payments
title: Paiements
audience: organisateur
access: billing.payments.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/payments/page.tsx
  - src/components/payments/PaymentFilters.tsx
  - src/components/payments/PaymentsTable.tsx
  - src/components/payments/status.ts
  - src/components/ui/Pagination.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:5c1f50195b335d30bf5116101af363e79f8dbfce9ee342556628da405d0bc2db
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les paiements de votre organisation : abonnements et commandes d'impression. Il sert à retrouver un paiement, suivre son statut et ouvrir sa fiche.

## Les filtres

Les filtres sont conservés dans l'adresse de la page : vous pouvez la recharger ou la partager sans perdre le résultat. Un nouveau filtre repart de la première page.

- **Statut** : Tous, En attente, Payé, Refusé, Annulé ou Expiré.
- **Type** : Tous, Abonnement ou Impression.
- **Du** / **Au** : période de création du paiement.
- **Référence FedaPay** : recherche par référence de transaction (par exemple « trx_… »).

**Filtrer** applique les critères ; **Réinitialiser** les efface.

## Le tableau

Colonnes : **Date**, **Type**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** (référence FedaPay, « — » si absente) et un lien **Voir** vers la fiche du paiement. S'il n'y a aucun résultat, l'écran affiche « Aucun paiement. » La pagination s'affiche sous le tableau.
