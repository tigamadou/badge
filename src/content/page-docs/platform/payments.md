---
route: /platform/payments
title: Paiements
audience: staff
access: payments.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/payments/page.tsx
  - src/components/payments/PaymentFilters.tsx
  - src/components/payments/PaymentsTable.tsx
  - src/components/payments/status.ts
  - src/components/ui/Pagination.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:d921325a74c16659057c45debf8f03bc60ed1410b8a5c264b6a7c7b5414613d2
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste tous les paiements de la plateforme, abonnements et commandes d'impression, toutes organisations confondues. Il sert à retrouver un paiement, suivre son statut et ouvrir sa fiche. L'écran est en lecture seule.

## Les filtres

Les filtres sont conservés dans l'adresse de la page : vous pouvez la recharger ou la partager sans perdre le résultat. Un nouveau filtre repart de la première page.

- **Organisation** : nom ou identifiant de l'organisation.
- **Statut** : Tous, En attente, Payé, Refusé, Annulé ou Expiré.
- **Type** : Tous, Abonnement ou Impression.
- **Du** / **Au** : période de création du paiement.
- **Référence FedaPay** : recherche par référence de transaction (par exemple « trx_… »).

**Filtrer** applique les critères ; **Réinitialiser** les efface.

## Le tableau

Colonnes : **Date**, **Organisation** (un clic ouvre sa fiche), **Type**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** (référence FedaPay, « — » si absente) et un lien **Voir** vers la fiche du paiement. S'il n'y a aucun résultat, l'écran affiche « Aucun paiement. » La pagination s'affiche sous le tableau.
