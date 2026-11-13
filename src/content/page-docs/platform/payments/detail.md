---
route: /platform/payments/[paymentId]
title: Détail d'un paiement
audience: staff
access: payments.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/payments/[paymentId]/page.tsx
  - src/components/payments/PaymentDetailView.tsx
  - src/components/payments/status.ts
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
sourceHash: sha256:3500751b659a093865bbb3485d4727dfa7bfe941fb39ad4cdecd0224bb218888
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche en lecture seule présente un paiement. Le lien **Paiements** en haut ramène à la liste.

## Le bloc Paiement

Il affiche : **Montant**, **Devise**, **Statut** (En attente, Payé, Refusé, Annulé ou Expiré), **Type** (Abonnement ou Impression), **Plan** ou **Commande** concerné (un clic ouvre la liste des plans ou la commande), **Changement** (Changement immédiat, Renouvellement ou Changement programmé, pour un abonnement), **Créé le**, **Approuvé le**, **Référence FedaPay**, **Identifiant FedaPay**, **Payeur** (nom et e-mail) et **Organisation** (un clic ouvre sa fiche). Une valeur absente s'affiche « — ».

## Le détail de l'abonnement

Pour un abonnement, un second bloc **Détail de l'abonnement** apparaît lorsque c'est pertinent : **Prix plein**, **Crédit déduit** (crédit au prorata de la période restante de l'ancien plan), **Montant payé**, et la **Période couverte**.

## Imprimer le reçu

Lorsque le paiement a le statut Payé, le bouton **Imprimer le reçu** ouvre le reçu dans un nouvel onglet.
