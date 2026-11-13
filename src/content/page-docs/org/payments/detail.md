---
route: /org/[orgId]/payments/[paymentId]
title: Détail d'un paiement
audience: organisateur
access: billing.payments.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/payments/[paymentId]/page.tsx
  - src/components/payments/PaymentDetailView.tsx
  - src/components/payments/status.ts
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
sourceHash: sha256:5e872bce124df02ea33c62efc5a4f70f8f5af89093fc50582ee17907ce538303
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche en lecture seule présente un paiement de votre organisation. Le lien **Paiements** en haut ramène à la liste. Un paiement qui n'appartient pas à votre organisation est introuvable.

## Le bloc Paiement

Il affiche : **Montant**, **Devise**, **Statut** (En attente, Payé, Refusé, Annulé ou Expiré), **Type** (Abonnement ou Impression), **Plan** ou **Commande** concerné, **Changement** (Changement immédiat, Renouvellement ou Changement programmé, pour un abonnement), **Créé le**, **Approuvé le**, **Référence FedaPay**, **Identifiant FedaPay** et **Payeur** (nom et e-mail). Une valeur absente s'affiche « — ».

## Le détail de l'abonnement

Pour un abonnement, un second bloc **Détail de l'abonnement** apparaît lorsque c'est pertinent : **Prix plein**, **Crédit déduit** (crédit au prorata de la période restante de l'ancien plan), **Montant payé**, et la **Période couverte**.

## Imprimer le reçu

Lorsque le paiement a le statut Payé, le bouton **Imprimer le reçu** ouvre le reçu dans un nouvel onglet.
