---
route: /platform/print/sheets/generated
title: Planches générées
audience: staff
access: print.sheets.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/sheets/generated/page.tsx
  - src/app/platform/print/sheets/sheets-data.ts
  - src/components/staff/print/GenerationForm.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/sheets/GenerateOrderSheetDialog.tsx
  - src/components/staff/print/sheets/GenerationStatePill.tsx
  - src/components/staff/print/sheets/OrderQueueTable.tsx
  - src/components/staff/print/sheets/merge-rows.ts
  - src/components/staff/print/sheets/transitions.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Tabs.tsx
  - src/components/ui/Toolbar.tsx
sourceHash: sha256:91e8c373d4f69bed67c705d304532f47df3bbce633882b88242ae79916df694f
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **Générées** liste les commandes qui ont une planche, avec son état et son téléchargement. La liste est paginée ; lorsqu'une génération est en cours, elle se met à jour toutes les 5 secondes et vous prévient quand une planche est prête ou en échec.

## Le tableau

Colonnes : **Commande** (un clic ouvre la commande), **Évènement**, **Organisation**, **Badges**, **Recto-verso**, **Payée le**, **État** (**En attente…**, **Génération en cours…**, **Prête** ou **Échec** avec son message), **Gabarit**, **Feuilles / pages**, **Générée le**. Sur une planche prête, **Télécharger** enregistre le PDF et **Voir** l'ouvre en aperçu (« Planche — référence »). S'il n'y a rien, l'écran affiche « Aucune planche générée. »

:::permission print.sheets.generate
## Regénérer une planche

Le bouton **Regénérer** de chaque ligne ouvre « Regénérer la planche — référence » : choisissez le **Gabarit** puis **Regénérer** (« Regénération lancée. »). La planche actuelle est remplacée. Le bouton est inactif tant qu'une génération est en attente ou en cours.
:::
