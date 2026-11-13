---
route: /platform/print/catalog
title: Catalogue d'impression
audience: staff
access: print.catalog.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/catalog/page.tsx
  - src/components/staff/print/CatalogList.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Tabs.tsx
sourceHash: sha256:4339b761cdfa6aad31eccea6c514bd532e8bc9910dbad8e8f3814bfb2d49f16c
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le catalogue liste les supports de badge et les accessoires proposés aux organisateurs. La liste est paginée.

## Les filtres

Deux sélecteurs se combinent :
- **Tous**, **Supports de badge** ou **Accessoires** (la famille du produit).
- **Actifs** (par défaut) ou **Archivés**.

## Le tableau

Colonnes : une vignette, **Nom** (un clic sur la ligne ou sur le nom ouvre la fiche), **Catégorie** (à défaut, la famille : « Support de badge » ou « Accessoire »), **À partir de** (prix le plus bas, en FCFA), **Statut** (**Publié**, **Brouillon** ou **Archivé**) et **Options** (nombre d'options). S'il n'y a aucun produit, l'écran affiche « Aucun produit dans le catalogue. »

:::permission print.catalog.manage
## Créer un produit

Le bouton **Nouveau produit** ouvre une fenêtre :
- **Famille** : **Support de badge** (par défaut) ou **Accessoire**.
- **Nom** : obligatoire.
- **Prix de base (FCFA)** : entier positif ou nul, 0 par défaut.

**Créer** (actif quand le nom et le prix sont valides) crée le produit (« Produit créé. ») et ouvre sa fiche pour le compléter. **Annuler** ferme la fenêtre.
:::
