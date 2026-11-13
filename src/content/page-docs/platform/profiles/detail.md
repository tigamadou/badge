---
route: /platform/profiles/[userId]
title: Validation d'un profil
audience: staff
access: profiles.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/profiles/[userId]/page.tsx
  - src/components/staff/ProfileReviewPanel.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:d34245e99dc5602bb566fc0fc0fc7d67f19520630df000b1e34406e5bc3afd51
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche permet d'examiner le profil d'un participant (photo et pièce d'identité) et de consulter l'historique de ses soumissions. Le lien **Profils** en haut ramène à la liste. Un compte staff ou inexistant est introuvable.

## Le profil

L'en-tête donne le nom, l'état du profil (En attente, Validé ou Rejeté), l'e-mail et la structure éventuelle. Le bloc affiche la **Photo** et la **Pièce d'identité** en aperçu, puis le **Type de pièce** et le **Numéro de pièce** (« — » si absents).

:::permission profiles.review
## Approuver ou rejeter

Lorsque la dernière soumission est en attente, deux boutons apparaissent sous le profil :
- **Approuver** (« Profil approuvé. »). S'il n'y a plus de soumission en attente : « Aucune soumission en attente. »
- **Rejeter** ouvre un encadré : choisissez un **Motif de rejet** (« Sélectionner un motif… »), ajoutez si besoin des **Détails (optionnel)**, puis **Confirmer le rejet** (« Profil rejeté. »), actif une fois un motif choisi. Un motif qui ne s'applique pas à un profil est refusé (« Ce motif ne s'applique pas à un profil. »).
:::

## Historique des soumissions

La liste des soumissions, de la plus récente à la plus ancienne : statut, motif de rejet et détails le cas échéant, date de soumission (« Soumis le … ») et date de décision (« décidé le … »). « Aucune soumission. » s'il n'y en a pas.
