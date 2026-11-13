---
route: /platform/print/sheets/free
title: Génération libre de planches
audience: staff
access: print.sheets.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/print/sheets/free/page.tsx
  - src/app/platform/print/sheets/sheets-data.ts
  - src/components/staff/print/GenerationForm.tsx
  - src/components/staff/print/GenerationList.tsx
  - src/components/staff/print/GenerationsScreen.tsx
  - src/components/staff/print/SheetPreview.tsx
  - src/components/staff/print/sheets/GenerationStatePill.tsx
  - src/components/staff/print/sheets/merge-rows.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/Table.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Tabs.tsx
  - src/components/ui/Toolbar.tsx
sourceHash: sha256:bbb62d292fbce04c9e6aef25186aa70d565f96bb22453f438f3350a2c5721f17
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **Génération libre** produit des planches pour des badges choisis à la main, sans passer par une commande, et conserve l'historique de ces générations. Seules les générations hors commande figurent dans l'historique.

:::permission print.sheets.generate
## Nouvelle génération

Le formulaire **Nouvelle génération** (« Choisissez les badges à imprimer et le gabarit de planche. ») comprend :
- **Organisation** puis **Évènement** (avec le nombre d'inscrits approuvés).
- **Inscriptions à imprimer** : **Tous les approuvés**, **Par catégorie** (une case par catégorie, avec son effectif) ou **Sélection**. En mode **Sélection**, recherchez un nom ou un identifiant, cochez les inscriptions ou utilisez **Tout sélectionner (N)** / **Tout désélectionner** ; la liste est limitée aux 5 000 premières inscriptions (un message l'indique) et affichée par tranches de 200 résultats : affinez la recherche pour voir les autres.
- **Gabarit** : parmi les gabarits non archivés.
- **Recto-verso (le template a deux pages)** : case proposée seulement si le template du badge a deux pages ; cochée par défaut.

À droite, **Aperçu de la planche** montre la disposition, le nombre de feuilles nécessaires et « N badge(s) sélectionné(s) ». **Générer** (actif quand tout est choisi et qu'au moins un badge est sélectionné) lance la génération (« Génération lancée. »).
:::

## L'historique

Le tableau **Historique** (« Les 50 dernières générations de planches. ») : **Date**, **Évènement**, **Gabarit**, **Badges**, **Feuilles**, **Statut** (**En attente…**, **Génération en cours…**, **Terminée** ou **Échec** avec son message ; un volet « N badge(s) écarté(s) » liste les badges ignorés), **Auteur**, puis pour une génération terminée **Aperçu** et **Télécharger**. S'il n'y a rien : « Aucune génération. » La liste se rafraîchit toutes les 5 secondes tant qu'une génération est en cours, et est paginée.
