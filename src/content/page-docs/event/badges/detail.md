---
route: /event/[eventId]/badges/[badgeId]
title: Fiche d'un badge
audience: staff
access: badge.print
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/badges/[badgeId]/page.tsx
  - src/components/badge/BadgeDocumentView.tsx
  - src/components/badge/BadgePrintActions.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:2eff511be8c9a969f2b7e64583576a1600a6c1673a60dc77ef5c8ced1bb62163
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche présente l'aperçu du badge d'une inscription, permet de le télécharger, de l'imprimer et de le marquer comme imprimé. Le lien **Badges** en haut ramène à la liste. Une inscription qui n'appartient pas à cet évènement est introuvable.

## L'aperçu et les actions

L'aperçu est généré à partir du modèle de badge de l'évènement. Pendant le chargement, « Chargement de l'aperçu… » s'affiche ; en cas d'échec, le bouton « Aperçu indisponible, réessayer » relance le chargement.

Sous l'aperçu :
- **Télécharger** : télécharge le badge en PDF.
- **Imprimer** : ouvre le PDF dans un nouvel onglet pour l'imprimer.
- **Marquer imprimé** : enregistre le badge comme imprimé (« Badge marqué imprimé. »). L'état à droite indique « Non imprimé », « Imprimé » ou « Imprimé le » suivi de la date.

Un aperçu, un téléchargement ou une impression ne marquent jamais le badge : seul le bouton **Marquer imprimé** le fait. Ce bouton est désactivé, avec une explication sous les actions, si l'évènement est archivé (« Événement archivé : le marquage est désactivé. ») ou si l'inscription n'est pas approuvée (« Seules les inscriptions approuvées peuvent être marquées imprimées. »).

## Informations

La carte **Informations** rappelle le **N°** de l'inscription, le **Nom** (« Identité masquée » si la catégorie est anonyme), la **Catégorie** et la mention **ALL ACCESS** (Oui ou Non). Le lien **Voir l'inscription** ouvre la fiche de l'inscription.
