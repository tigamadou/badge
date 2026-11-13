---
route: /platform/badge-templates
title: Templates de badge
audience: staff
access: badge_templates.read
sources:
  - src/app/platform/badge-templates/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/staff/BadgeTemplateArchiveButton.tsx
  - src/components/staff/BadgeTemplateInstaller.tsx
  - src/components/staff/InstallFileStep.tsx
  - src/components/staff/InstallSummaryStep.tsx
  - src/components/staff/install-machine.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Stepper.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:76e5defd93a148ce952003cbca488ddddbd9561f6db83fab17d322b8b06c7b10
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les modèles de badge installés sur la plateforme. Chaque installation crée une version figée : les évènements qui utilisent une version antérieure ne sont pas affectés.

:::permission badge_templates.manage
## Installer un template

Le bloc **Installer un template** accepte une archive ZIP contenant `manifest.json` à la racine et, si besoin, les dossiers `assets/` (JPEG, PNG) et `fonts/` (TTF, OTF). Le bouton **Installer un template** ouvre une fenêtre en deux étapes, **Fichier** puis **Récapitulatif** :
- **Fichier** : déposez l'archive .zip (ou cliquez pour la choisir ; la taille maximale est indiquée dans la zone de dépôt). Une barre de progression suit l'envoi, puis « Analyse du paquet… ». En cas d'erreur, la liste des problèmes s'affiche et **Choisir un autre fichier** permet de recommencer.
- **Récapitulatif** : aperçu, nom, famille, nombre de pages et numéro de la prochaine version, puis deux listes dépliables : **Données de badge** (les variables fournies au badge) et **Options du template** (réglées par évènement dans les paramètres de l'évènement). **Installer** lance l'installation (« Installation et rendu d'épreuve… ») ; à la fin, « Template installé (version N) » et **Fermer**.

Fermer la fenêtre pendant une opération demande confirmation (« Abandonner l'installation ? »).
:::

## Le catalogue

Chaque ligne montre une vignette, le nom du template (un clic ouvre sa fiche), sa famille et sa version (« famille · vN »), le nombre de pages, les dimensions en pixels et la date d'installation. Une petite icône d'imprimante signale un template proposé pour l'impression sur place. Un badge indique **Disponible** ou **Archivé**. La liste est paginée.

S'il n'y a aucun template installé, l'écran indique que les badges utilisent les modèles livrés avec l'application.

:::permission badge_templates.manage
## Archiver et restaurer

Sur chaque ligne, **Archiver** retire le template du catalogue disponible (« Template archivé. ») et **Restaurer** le remet à disposition (« Template restauré. »).
:::
