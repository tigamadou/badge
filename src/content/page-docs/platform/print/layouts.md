---
route: /platform/print/layouts
title: Gabarits d'impression
audience: staff
access: print.layouts.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/layouts/page.tsx
  - src/components/staff/print/LayoutList.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/layout-form.ts
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
sourceHash: sha256:ed0a70e7f0dab7a5db4f4e3b647db339a8945986a9891081e5c65c73d96defdd
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les gabarits d'impression : formats de planche, marges et espacements utilisés pour imprimer les badges. Seuls les gabarits non archivés sont listés. La liste est paginée.

## Les cartes

Chaque gabarit s'affiche sous forme de carte : un dessin de la feuille (un clic l'ouvre), le nom, le format en mm avec l'orientation (**Portrait** ou **Paysage**), les marges et l'espacement, et des pastilles : **Retournement** (bord long ou bord court) et **Traits de coupe** s'ils sont activés. Le lien **Voir** ouvre le gabarit en lecture seule.

S'il n'y a aucun gabarit, l'écran affiche « Aucun gabarit » : un gabarit décrit la feuille, ses marges et la façon d'y ranger les badges.

:::permission print.layouts.manage
## Créer, modifier, archiver

- **Nouveau gabarit** (en haut à droite) et, quand la liste est vide, **Créer le premier gabarit** ouvrent le formulaire de création.
- Sur chaque carte, **Voir** devient **Modifier**, et **Archiver** retire le gabarit de la liste (« Gabarit archivé. »).
:::
