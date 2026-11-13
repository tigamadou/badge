---
route: /org/[orgId]/subscription/return
title: Retour de paiement
audience: organisateur
access: billing.subscription.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/subscription/return/page.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:2934a0e2a6837a502f3c6f40c322eaa4451c50d3058ec5aaf9fe43d08c2c5eb5
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Vous arrivez sur cet écran après un paiement d'abonnement sur FedaPay. Il indique le résultat du paiement.

## Les résultats possibles

- **Paiement confirmé. Votre abonnement … est actif.** : le plan est actif immédiatement.
- **Paiement confirmé. Votre abonnement … sera activé le …** : le changement est programmé ; il prend effet à la date indiquée, ou à la fin de la période en cours si aucune date n'est connue.
- **Paiement en cours de confirmation.** : FedaPay n'a pas encore confirmé. Le lien **Actualiser** recharge l'écran pour vérifier à nouveau.
- **Le paiement n'a pas abouti. Votre abonnement n'a pas changé.** : aucun changement n'a été appliqué.
- **Paiement introuvable.** : l'identifiant du paiement ne correspond à aucun paiement de l'organisation.

Le lien **Retour à l'abonnement** ramène à l'écran Abonnement.
