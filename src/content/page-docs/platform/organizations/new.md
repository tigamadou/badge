---
route: /platform/organizations/new
title: Nouvelle organisation
audience: staff
access: organizations.create
sources:
  - src/app/platform/organizations/new/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/staff/OrgCreationForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:fa8d907a05f5fbcde05c8f203666d3836fd48197fdfd1f1d183de4610f8d5862
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Ce formulaire crée une organisation et son premier OWNER. L'abonnement (plan et limites) se gère ensuite depuis la fiche de l'organisation.

## Organisation

- **Nom de l'organisation** : obligatoire.
- **Slug (généré automatiquement)** : en lecture seule, déduit du nom au fil de la saisie. C'est un aperçu : si ce slug existe déjà, le serveur le complète par un suffixe (-2, -3…).

## OWNER initial

Un utilisateur est créé s'il n'existe pas et reçoit un e-mail d'invitation pour définir son mot de passe.
- **E-mail du OWNER** : obligatoire.
- **Nom complet du OWNER (optionnel)**.

## Valider

**Créer l'organisation** reste inactif tant que le nom et l'e-mail ne sont pas renseignés ; une fois créée, vous arrivez sur la fiche de l'organisation. **Annuler** revient à la liste. En cas d'échec : « Erreur à la création. »
