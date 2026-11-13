---
route: /org/[orgId]/activity/[logId]
title: Détail d'une entrée du journal
audience: organisateur
access: org.activity.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/activity/[logId]/page.tsx
  - src/components/activity/JournalEntryActions.tsx
  - src/components/activity/JournalEntryDetail.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/PickCard.tsx
sourceHash: sha256:fd8d467a95dc4c31fe76d51347f8a207902dbd45bf47b8aece748f88240ae6de
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche en lecture seule détaille une entrée du journal d'activité de votre organisation. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée qui n'appartient pas à votre organisation est introuvable.

## L'en-tête

Le type de l'action, le numéro « ENTRÉE # », une description en clair et la date et l'heure. Deux boutons :
- **Copier l'ID** : copie l'identifiant de l'entrée (le bouton affiche « Copié » un instant).
- **Exporter JSON** : télécharge l'entrée au format JSON.

## Détails de l'action

**Type**, **Auteur** (adresse e-mail, ou « Système »), **Contexte** (l'organisation ou l'évènement concerné) et **Staff** (Oui si l'action vient du staff de la plateforme).

## Modification

Lorsque l'action a modifié des valeurs, le bloc **Modification** montre pour chaque champ la valeur avant et après.

## Charge utile brute

Les données techniques de l'évènement, telles qu'enregistrées.

## Colonne latérale

- **Auteur** : nom, rôle éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.
- **Contexte** : l'organisation, l'évènement éventuel et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.
