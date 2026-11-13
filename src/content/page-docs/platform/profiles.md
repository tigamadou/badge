---
route: /platform/profiles
title: Profils participants
audience: staff
access: profiles.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/profiles/page.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/StatusBadge.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:1331aca307eb2b09ef51edce30776f4d842d4e169406329b72e635995c6b611f
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les profils de participants dont la plateforme valide les documents d'identité. Les comptes staff n'y figurent pas. La liste est paginée.

## Les onglets

**En attente** (affiché par défaut), **Rejetés** et **Validés** filtrent les profils par état. Un onglet conserve la recherche en cours.

## La recherche

**Rechercher (nom, e-mail, numéro de pièce)…** puis **Filtrer** : la recherche porte sur le prénom, le nom, l'e-mail et le numéro de pièce.

## Le tableau

Colonnes : **Nom** (un clic ouvre la fiche du profil), **E-mail**, **Pièce** (type et numéro), **Statut** (En attente, Validé ou Rejeté) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucun profil dans cet état. »
