---
route: /event/[eventId]/print/onsite
title: Poste sur place
audience: staff
access: print.onsite.operate
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/print/onsite/page.tsx
  - src/components/event/print/OnsiteOrderList.tsx
  - src/components/print/PrintRequestStatusBadge.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:6087c1bb68ab06a7e93a54cb87021cdb23618b3ce8465939ec1264ae0abb9e15
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les commandes d'impression sur place ouvertes au poste de l'évènement : vous y choisissez celle sur laquelle vous imprimez les badges des participants déjà approuvés. Il ne montre ni prix ni lignes de devis.

## La liste

Seules les commandes sur place au statut Payée, En production ou Prête sont listées, de la plus récente à la plus ancienne. Chaque ligne affiche la référence, le lieu d'impression s'il est connu, le statut, et le lien **Ouvrir le poste** qui ouvre le poste d'impression de la commande.

S'il n'y en a aucune, ou si l'évènement est archivé : « Aucune commande ouverte au poste sur place. »
