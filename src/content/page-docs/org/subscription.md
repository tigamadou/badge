---
route: /org/[orgId]/subscription
title: Abonnement
audience: organisateur
access: billing.subscription.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/subscription/page.tsx
  - src/components/admin/PaymentHistory.tsx
  - src/components/admin/PlanCatalog.tsx
  - src/components/payments/status.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:e1dfbf776b4c9f3b60e014443d156cb072e1fe154acc667fdbaa20e48d56053b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran présente le plan de votre organisation, ses limites, les plans disponibles et l'historique des paiements.

## Abonnement inactif

Si l'abonnement n'est pas actif, un avertissement l'indique : la création d'évènements et l'accès à certaines pages sont limités, les évènements en cours restent ouverts. Vous pouvez renouveler depuis cet écran ou contacter le support.

## Détails

Le bloc **Détails** affiche le **Plan**, le **Statut**, la **Période** (« Annuel (365 jours) » ou « Mensuel (30 jours) »), le **Début**, la **Fin** (« Sans échéance » le cas échéant), **Actif** (Oui ou Non) et, si un changement a été programmé, la ligne **Changement programmé** avec le plan et la date.

## Changer de plan

Le bloc **Changer de plan** présente chaque plan en vente : nom, prix en FCFA par mois ou par an, limites d'évènements et de participants par évènement (« illimité » si aucune limite), et les mentions « Plan actuel » ou « Programmé ». Pour un changement immédiat avec crédit, le calcul est détaillé : prix plein, moins le crédit de la période restante, égale le montant à payer. Le montant exact est figé à la création du paiement.

Un plan ne peut pas être choisi dans certains cas : abonnement déjà actif (la date de fin et la date à partir de laquelle le renouvellement est possible sont alors indiquées), ou crédit couvrant déjà le plan (contactez le support).

:::permission billing.subscription.pay
Chaque plan a un bouton : **Renouveler** pour le plan actuel, **Passer à ce plan**, ou **Programmer à l'échéance** lorsque le changement prendra effet à la fin de la période en cours. Le bouton ouvre le paiement en ligne FedaPay. Un message d'erreur s'affiche si le paiement ne peut pas démarrer (changement déjà programmé, paiement déjà en cours, paiement en ligne indisponible, plan retiré de la vente).
:::

Sans le droit de payer l'abonnement, l'écran précise que seul le propriétaire de l'organisation peut changer d'abonnement et n'affiche aucun bouton.

## Limites effectives

Le bloc **Limites effectives** indique le nombre d'**Événements** et de **Participants / événement** autorisés (« Illimité » si aucune limite).

## Historique des paiements

Les 20 derniers paiements : **Date**, **Objet**, **Montant**, **Statut**, **Référence**, et un lien **Voir** vers la fiche. Le lien **Voir tous les paiements** mène à la liste complète.
