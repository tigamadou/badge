---
route: /platform/organizations/[orgId]
title: Fiche d'une organisation
audience: staff
access: organizations.read
sources:
  - src/app/platform/organizations/[orgId]/OrgDetailActions.tsx
  - src/app/platform/organizations/[orgId]/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Modal.tsx
  - src/components/ui/QuotaBar.tsx
  - src/components/ui/StatCard.tsx
sourceHash: sha256:9333698777af59fe150051e43285a59b372909fabfe8030ea8cd5c8438fe4603
updatedAt: 2026-11-13
---

## À quoi sert cet écran

La fiche présente une organisation en **supervision, lecture seule** : le staff consulte l'organisation depuis la plateforme, sans entrer dans son espace.

## En-tête et onglets

Le lien **← Organisations** ramène à la liste. Les onglets **Fiche**, **Événements**, **Membres** et **Abonnement** mènent aux pages de supervision ; l'onglet **Journal** n'apparaît que si vous avez le droit de consulter le journal plateforme. Sous le titre : le slug et le nombre d'événements ; une organisation archivée porte la mention « Archivée le … ».

## Chiffres clés

**Événements**, **OWNERs** et **Plan** (« Aucun » sans abonnement).

## Abonnement

Un résumé : jauge **Événements** (utilisés sur le maximum, « ∞ » si illimité), **Statut**, **Période** (Annuel, Mensuel ou « — »), **Participants / event** (« Illimité » sans plafond) et **Actif**. Le lien en haut à droite s'appelle **Gérer** si vous pouvez attribuer un abonnement, **Voir** sinon.

## Informations administratives

**Raison sociale**, **Adresse**, **Identifiant fiscal**, **Site web**, **Contact e-mail** et **Contact téléphone** (« — » quand ils ne sont pas renseignés).

## OWNERs

Nom et e-mail des propriétaires ; « Aucun OWNER associé. » s'il n'y en a pas.

## Derniers événements

Les vingt derniers événements (titre, mention « archivé », date et nombre d'inscriptions) ; « Aucun événement. » s'il n'y en a pas.

## Zone de danger

Ce bloc n'apparaît que si vous avez au moins l'un des deux droits ci-dessous.

:::permission organizations.archive
- **Archiver** (« Organisation archivée. ») et, pour une organisation archivée, **Restaurer** (« Organisation restaurée. »).
:::

:::permission organizations.delete
- **Supprimer définitivement** : action irréversible. La fenêtre « Supprimer définitivement l'organisation » demande de saisir le slug exact dans **Slug de confirmation** ; sinon « Confirmation invalide : saisissez le slug exact. » Après suppression, vous revenez à la liste.
:::

Sans le droit de suppression, l'écran précise que la suppression définitive est réservée aux super administrateurs.
