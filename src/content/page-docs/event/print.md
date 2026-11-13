---
route: /event/[eventId]/print
title: Impression
audience: organisateur
access: print.request
sources:
  - src/app/event/[eventId]/print/page.tsx
  - src/components/event/print/guard.ts
  - src/components/print/OrgPrintCreditCard.tsx
  - src/components/print/PrintRequestStatusBadge.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:a640ef39e44044cfe5949d4c49523a0be2c96e1d5d25a7ece51b33433d834361
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les commandes d'impression de badges de l'évènement et vous permet d'en créer. Une commande est suivie avec l'équipe Badge : elle passe par un devis, que vous acceptez puis réglez.

## Nouvelle commande

Le bouton **Nouvelle commande** ouvre l'assistant de création. Il n'est pas proposé pour un évènement archivé, ni au staff de la plateforme en consultation (lecture seule).

## Crédit d'impression

Lorsque votre organisation a un solde de crédit d'impression ou un historique de mouvements, la carte **Crédit d'impression** affiche le solde en FCFA et la liste des mouvements (crédits gagnés, par exemple pour des badges non utilisés, et crédits appliqués à une commande). Sans solde ni historique, la carte n'apparaît pas.

## Le tableau

Colonnes : **Référence** (lien vers la commande), **Type** (« En amont » ou « Pendant l'évènement »), **Badges**, **Total** (en FCFA), **Statut** et **Envoyée le** (« — » tant qu'elle n'est pas envoyée). Une pastille dorée à côté de la référence indique le nombre de messages non lus de l'équipe Badge. S'il n'y a aucune commande : « Aucune commande d'impression pour cet évènement. » La liste est paginée.

Les statuts possibles sont : Brouillon, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée et Annulée.
