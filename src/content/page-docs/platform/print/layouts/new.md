---
route: /platform/print/layouts/new
title: Nouveau gabarit d'impression
audience: staff
access: print.layouts.manage
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/layouts/new/page.tsx
  - src/components/staff/print/BadgeWitnessPicker.tsx
  - src/components/staff/print/LayoutEditor.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/layout-form.ts
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:4aa0e35c04e76382d24c6c376c137ae051630924f48e75de54009f98f1da914c
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran crée un gabarit d'impression. Il est réservé aux profils qui peuvent gérer les gabarits : les autres sont renvoyés à la liste. Le lien **Gabarits d'impression** en haut ramène à la liste.

## Valeurs par défaut

Un nouveau gabarit démarre au format **A3**, en **Portrait**, avec des marges de 10 mm, des espaces de 0 mm, une orientation de badges **Automatique**, un retournement **Bord long** et les **Traits de coupe** activés.

## Les réglages

Les champs sont ceux de l'éditeur de gabarit :
- **Nom** (obligatoire) ;
- **Format** (**A3**, **A4**, **SRA3** ou **Libre** avec **Largeur (mm)** et **Hauteur (mm)**, la largeur devant être inférieure ou égale à la hauteur) et **Orientation de la feuille** ;
- les quatre marges (avec l'interrupteur **Marges identiques**) et les espaces **horizontal** et **vertical** ;
- **Orientation des badges** : **Automatique**, **Originale** ou **Pivotée** ;
- **Retournement recto verso** : **Bord long** ou **Bord court** ; **Traits de coupe**.

À gauche, l'**Aperçu en direct** montre la planche avec un badge témoin (**Template installé** ou **Taille libre**).

## Enregistrer

**Enregistrer** reste inactif tant que le nom est vide ou que les dimensions sont invalides ; il crée le gabarit (« Gabarit créé. ») et ramène à la liste. « Ce nom de gabarit existe déjà. » si le nom est pris. **Annuler** revient à la liste.
