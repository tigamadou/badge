---
route: /platform/print/layouts/[layoutId]
title: Gabarit d'impression
audience: staff
access: print.layouts.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/layouts/[layoutId]/page.tsx
  - src/components/staff/print/BadgeWitnessPicker.tsx
  - src/components/staff/print/LayoutEditor.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/layout-form.ts
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:7e5c4a4fe6fb5bee4e9ec6aca57b691094e924cefd5699cfea53c106cb4b8cd8
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran présente un gabarit d'impression avec un aperçu en direct de la planche. Le lien **Gabarits d'impression** en haut ramène à la liste. Un gabarit inexistant ou archivé est introuvable. Avec le seul droit de consulter les gabarits, tous les champs sont en lecture seule et le bouton en haut s'appelle **Retour**.

## Aperçu en direct

À gauche, la planche se met à jour à chaque saisie. Le **Template installé** sert de badge témoin (parmi les templates non archivés, avec leurs dimensions et la mention « recto-verso » le cas échéant) ; **Taille libre** permet de saisir **Largeur du badge (mm)** et **Hauteur du badge (mm)** (84 × 120 par défaut). Une pastille indique **Recto-verso** ou **Recto seul**. L'aperçu indique le nombre de badges par feuille, ou « Ce badge ne tient pas dans ce gabarit ». La légende distingue la zone utile, les emplacements et les traits de coupe. Sans dimensions valides : « Saisissez des dimensions valides pour voir l'aperçu. »

## Identité

**Nom** : permet de retrouver le gabarit à la génération. « Ce nom de gabarit existe déjà. » si le nom est pris.

## Feuille

- **Format** : **A3**, **A4**, **SRA3** ou **Libre** (sur mesure). En mode **Libre**, saisissez **Largeur (mm)** et **Hauteur (mm)** ; la largeur doit être inférieure ou égale à la hauteur.
- **Orientation de la feuille** : **Portrait** ou **Paysage**.

## Marges et espacements

Quatre marges (**Haut**, **Droite**, **Bas**, **Gauche**, en mm) autour de la **Zone utile**. L'interrupteur **Marges identiques** les règle toutes ensemble. **Espace horizontal (mm)** et **Espace vertical (mm)** fixent la distance entre les badges.

## Disposition des badges

**Orientation des badges** : **Automatique** (le plus de badges), **Originale** (sens du template) ou **Pivotée** (tournés de 90°). Faire pivoter les badges peut en placer davantage par feuille.

## Impression

À régler selon la presse, en vérifiant sur une planche de contrôle :
- **Retournement recto verso** : **Bord long** (le plus courant) ou **Bord court** (retournement « calendrier »).
- **Traits de coupe** : interrupteur.

:::permission print.layouts.manage
## Enregistrer ou archiver

- **Enregistrer** valide les modifications (« Gabarit mis à jour. ») ; il reste inactif tant que le nom est vide ou que les dimensions sont invalides. **Annuler** revient à la liste sans enregistrer.
- **Archiver** demande confirmation (« Archiver ce gabarit ? Il ne pourra plus servir à générer des planches. »).
:::
