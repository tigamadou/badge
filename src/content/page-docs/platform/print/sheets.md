---
route: /platform/print/sheets
title: Planches d'impression (commande ciblée)
audience: staff
access: print.sheets.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/sheets/page.tsx
  - src/app/platform/print/sheets/sheets-data.ts
  - src/components/staff/print/GenerationForm.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/sheets/LinkedOrderSheet.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/Tabs.tsx
  - src/components/ui/Toolbar.tsx
sourceHash: sha256:522ec426ef4878a355883d1974652a1a17c2f2d0ec8041901ceffa47e03d3d59
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Les planches d'impression sont des PDF prêts à imprimer : une par commande payée, plus la génération libre. L'en-tête **Planches d'impression** et les onglets **À traiter (N)**, **Générées** et **Génération libre** sont communs à toutes les pages de cette zone.

Ouverte sans commande ciblée, cette adresse redirige vers l'onglet **À traiter**. Elle ne s'affiche réellement que lorsqu'elle est ouverte depuis le lien **Générer les planches** d'une commande.

## Depuis une commande

- Si la commande n'est pas une commande en amont payée, en production ou prête, un message l'indique : « Les planches ne peuvent être générées que pour une commande payée, en production ou prête. »
- Sans le droit de générer des planches, le message « Vous n'avez pas le droit de générer des planches. » s'affiche.

:::permission print.sheets.generate
## Générer les planches de la commande

Le formulaire **Planches de la commande …** reprend l'organisation, l'évènement et les badges de la commande (dans l'ordre de la commande) ; seul le gabarit est à choisir :
- **Gabarit** : parmi les gabarits non archivés (« Aucun gabarit : créez-en un dans « Gabarits » avant de générer. » s'il n'y en a pas).
- Pour un template recto-verso, « Recto-verso imposé (le template a deux pages). »
- À droite, **Aperçu de la planche** montre la disposition et le nombre de feuilles nécessaires.

**Générer** lance la génération (« Génération lancée. ») et ouvre l'onglet **Générées**.
:::
