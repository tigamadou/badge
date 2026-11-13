---
route: /platform/print/catalog/[productId]
title: Fiche produit du catalogue
audience: staff
access: print.catalog.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/catalog/[productId]/page.tsx
  - src/components/print/ProductCard.tsx
  - src/components/print/ProductConfigurator.tsx
  - src/components/print/ProductGallery.tsx
  - src/components/staff/print/ProductEditor.tsx
  - src/components/staff/print/ProductGalleryEditor.tsx
  - src/components/staff/print/ProductOptionsEditor.tsx
  - src/components/staff/print/ProductTiersEditor.tsx
  - src/components/staff/print/catalog-api.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/Tabs.tsx
sourceHash: sha256:07930de037884a399b1a895728d9bb3efc4e8cbf1dba0732b734c0c54890dcf6
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche présente un produit du catalogue d'impression : informations, galerie, tarifs dégressifs, options et aperçu. Le lien **← Catalogue** ramène à la liste. Le titre est suivi de l'état du produit : **Publié**, **Brouillon** ou **Archivé**. Les cinq onglets sont **Informations**, **Galerie**, **Tarifs**, **Options** et **Aperçu**.

Avec le seul droit de consulter le catalogue, tous les champs sont en lecture seule. Un produit archivé est également en lecture seule.

## Informations

**Nom** (120 caractères au plus), **Catégorie** (60 au plus), **Description** (5 000 au plus), **Prix de base (FCFA)** (entier positif ou nul), **Quantité minimale** (au moins 1) et **Délai (jours)** (entier ; vide = non précisé).

## Galerie

La première image est l'image principale. Chaque image porte un **Texte alternatif** (200 caractères au plus). Jusqu'à 10 images, au format JPEG, PNG ou WebP et 5 Mo au plus chacune. « Aucune image. » s'il n'y en a pas.

## Tarifs

Prix unitaire dégressif selon la quantité commandée : chaque palier se lit « À partir de N unités : P FCFA ». Sans palier, le prix de base s'applique.

## Options

Les options que l'organisateur peut choisir sur ce produit. Pour chaque option : **Nom** (80 caractères au plus), **Type** (Choix unique, Choix multiple, Couleur, Répartition de quantité, Texte ou Fichier), **Aide** (300 au plus) et **Obligatoire**. Selon le type :
- **Texte** et **Fichier** n'ont pas de valeurs : un **Supplément (FCFA)** s'applique à l'option, et pour un texte une **Longueur max (caractères)** entre 1 et 200.
- Les autres types ont des valeurs, chacune avec un **Libellé** (80 au plus), un **Supplément (FCFA)**, une vignette facultative et, pour **Couleur**, une couleur.

Le type d'une option existante ne se change pas : il faut la retirer et en créer une nouvelle. « Aucune option. » s'il n'y en a pas.

## Aperçu

La fiche telle que l'organisateur la verra, avec sa configuration. Un brouillon s'aperçoit comme une fiche publiée.

:::permission print.catalog.manage
## Modifier le produit

Ces commandes n'apparaissent que si vous pouvez gérer le catalogue et que le produit n'est pas archivé :
- **Publié** (interrupteur en haut de la fiche) : publie ou dépublie le produit (« Statut mis à jour. »).
- **Archiver** : après confirmation (« Archiver ce produit ? »), le produit disparaît de la vitrine ; les commandes d'impression existantes le conservent (« Produit archivé. »).
- **Informations** : **Enregistrer** (« Produit enregistré. »). Messages de contrôle : « Le nom est requis. », « Le prix de base doit être un entier positif ou nul. », « La quantité minimale doit être au moins 1. »
- **Galerie** : ajout d'images par dépôt (**Ajouter des images**), **Monter**, **Descendre**, **Retirer**, puis **Enregistrer la galerie** (« Galerie enregistrée. »).
- **Tarifs** : **Ajouter un palier** (quantité d'au moins 2, prix entier ; deux paliers ne peuvent pas avoir la même quantité), **Retirer**, **Enregistrer les tarifs** (« Tarifs enregistrés. »).
- **Options** : **Ajouter une option**, **Ajouter une valeur**, **Ajouter une vignette** / **Changer la vignette** / **Retirer la vignette**, **Monter**, **Descendre**, **Retirer**, **Retirer l'option**, puis **Enregistrer les options** (« Options enregistrées. »). Chaque option exige un nom, et un type à valeurs exige au moins une valeur.
:::
