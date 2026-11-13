---
route: /platform/print/sheets/pending
title: Planches à traiter
audience: staff
access: print.sheets.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/sheets/pending/page.tsx
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
sourceHash: sha256:ab74ea978df286b9e6de372a76be8593dda191bed4f1a41d7501ba5d141c5083
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **À traiter** liste les commandes payées dont la planche n'a pas encore été générée. Le compteur de l'onglet donne leur nombre. La liste est paginée ; lorsqu'une génération est en cours, elle se met à jour toutes les 5 secondes et vous prévient quand une planche est prête (« Planche de … prête ») ou en échec.

## Le tableau

Colonnes : **Commande** (un clic ouvre la commande), **Évènement**, **Organisation**, **Badges**, **Recto-verso** (Oui lorsque le template a deux pages), **Payée le** et **État** (**En attente…**, **Génération en cours…**, **Prête** ou **Échec** avec son message). S'il n'y a rien, l'écran affiche « Aucune commande à traiter. »

:::permission print.sheets.generate
## Générer une planche

Le bouton **Générer** de chaque ligne ouvre « Générer la planche — référence » : le nombre de badges, le **Gabarit** à choisir (« Aucun gabarit : créez-en un dans « Gabarits » avant de générer. » s'il n'y en a pas) et un aperçu de la disposition. Pour un template recto-verso, le recto-verso est imposé. **Générer** lance la génération (« Génération lancée. »). Le bouton est inactif tant qu'une génération est en attente ou en cours.
:::
