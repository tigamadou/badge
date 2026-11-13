---
route: /platform/organizations/[orgId]/subscription
title: Abonnement d'une organisation
audience: staff
access: organizations.read
sources:
  - src/app/platform/organizations/[orgId]/subscription/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/admin/PaymentHistory.tsx
  - src/components/payments/status.ts
  - src/components/staff/SubscriptionForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:7297bc0abb25420382b55d419cc3cf6a8966f19bb04eb694b4b5daa539c4e5fd
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran montre l'abonnement d'une organisation. Le lien **Organisations** en haut ramène à la liste. Sous le titre « Abonnement — nom de l'organisation », la mention « Abonnement de l'organisation (lecture seule) » rappelle que vous ne pouvez rien modifier ; avec le droit d'attribuer un abonnement, elle devient « Assigner un plan et gérer le statut de l'abonnement ».

## Le résumé de l'abonnement

Sans abonnement et sans droit de modification, l'écran affiche « Aucun abonnement. » Sinon, un résumé : **Plan**, **Statut**, **Période**, **Fin** (« Sans échéance » si aucune date), **Changement programmé** (plan qui prendra le relais à la fin, lorsqu'il y en a un), **Override max events** et **Override max participants/event** (« — » s'il n'y a pas de surcharge).

:::permission subscriptions.update
## Modifier l'abonnement

Le bouton **Modifier** (ou le formulaire directement, si l'organisation n'a pas encore d'abonnement) ouvre :
- **Plan** : parmi les plans non archivés.
- **Statut** : ACTIVE, EXPIRED ou CANCELLED.
- **Période** : lecture seule, définie par le plan (« Annuel (365 jours) » ou « Mensuel (30 jours) »). Les dates de début et de fin sont calculées à l'enregistrement.
- **Override max events** et **Override max participants/event** : surcharges des limites du plan ; laissez vide pour appliquer celles du plan.

**Enregistrer l'abonnement** valide (« Abonnement enregistré. ») ; **Annuler** revient au résumé.
:::

:::permission payments.read
## Historique des paiements

Les 50 derniers paiements de l'organisation : **Date**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** et un lien **Voir** vers le détail du paiement. « Aucun paiement. » s'il n'y en a pas.
:::
