---
route: /event/[eventId]/print/[requestId]/return
title: Retour de paiement
audience: organisateur
access: print.request
sources:
  - src/app/event/[eventId]/print/[requestId]/return/page.tsx
  - src/components/event/print/guard.ts
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:6a4649ada0c3baf2835c06db6abc0131fc6d6786022001ddcdb58fc2e65a1223
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Vous arrivez sur cette page en revenant de la page de paiement FedaPay, après le règlement d'un devis d'impression. Elle affiche le résultat du paiement ; seul l'état confirmé par FedaPay fait foi.

## Les résultats possibles

- **Paiement confirmé** : « Paiement confirmé. La commande … est payée ; l'équipe Badge lance la production. »
- **Paiement reçu** : « Paiement reçu. L'équipe Badge vérifie votre commande et revient vers vous. » (paiement reçu mais non rapproché de la commande) ; ou « Paiement reçu pour un montant inattendu. L'équipe Badge vérifie et vous recontacte. »
- **Paiement en cours de confirmation** : la page se met à jour dès que FedaPay confirme ; le lien **Actualiser** recharge l'état.
- **Échec** : « Le paiement n'a pas abouti. Votre devis reste accepté : vous pouvez réessayer. »
- **Paiement introuvable** : le paiement n'existe pas pour cette commande.

Le lien **Retour à la commande** ramène à la page de la commande.
