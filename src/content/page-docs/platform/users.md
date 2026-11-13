---
route: /platform/users
title: Utilisateurs
audience: staff
access: users.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/users/page.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:a5fe72389f5ce6ce179a97e61b0186af37bddfd61d5f3de4024863c3342c9ec9
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les comptes staff et clients de la plateforme. La liste est paginée.

## Rechercher et filtrer

- **Rechercher un utilisateur…** : recherche sur le nom ou l'e-mail.
- Le sélecteur de type : **Tous** (par défaut), **Staff** ou **Clients**.
- **Archivés** : par défaut, seuls les comptes actifs sont listés ; cochez la case pour ne voir que les comptes archivés.

Les filtres s'appliquent au clic sur **Filtrer**.

## Le tableau

Colonnes : **Nom** (initiales, nom cliquable et mention « Archivé » le cas échéant), **E-mail** (masqué sur petit écran), **Type** (le rôle plateforme pour un compte staff, **Client** sinon), **Organisations** (nombre d'appartenances ; masqué sur petit écran) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucun utilisateur. »

## Créer un utilisateur

Le bouton **Créer un utilisateur** ouvre le formulaire de création. Il est affiché à tous, mais le formulaire n'est accessible qu'avec le droit de créer un compte client ou un compte staff : sinon, vous revenez à cette liste.
