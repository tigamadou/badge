---
route: /platform/activity/[logId]
title: Détail d'une entrée du journal
audience: staff
access: activity.read
sources:
  - src/app/platform/activity/[logId]/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/activity/JournalEntryActions.tsx
  - src/components/activity/JournalEntryDetail.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/PickCard.tsx
sourceHash: sha256:c4946ba0a3ec671a089e9257d75829bb64e9e29073187a365f6d199b9031abee
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche en lecture seule détaille une entrée du journal d'activité de la plateforme. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée inexistante est introuvable.

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

- **Auteur** : nom, rôle plateforme éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.
- **Contexte** : l'organisation (un clic ouvre sa fiche), l'évènement éventuel et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.
