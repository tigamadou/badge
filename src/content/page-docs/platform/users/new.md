---
route: /platform/users/new
title: Nouvel utilisateur
audience: staff
sources:
  - src/app/platform/users/new/page.tsx
  - src/components/permissions/RoleSelect.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/staff/UserCreationForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/RadioCards.tsx
sourceHash: sha256:3fb395e69b514178a18030ec6b7858ea63cbc6b9f07252d508031169afe5b312
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Ce formulaire crée un compte et envoie une invitation. Il est réservé au staff qui peut créer un compte client ou un compte staff ; sans l'un de ces droits, vous revenez à la liste des utilisateurs.

## Compte

- **Adresse e-mail** : obligatoire. « E-mail déjà utilisé. » si un compte existe déjà.
- **Nom complet** : obligatoire.

## Type de compte

Deux choix, proposés selon vos droits :
- **Client** (« Rattaché à une organisation. ») : proposé avec le droit de créer un compte client ; c'est le choix par défaut dans ce cas.
- **Staff applicatif** (« Administration de la plateforme. ») : proposé avec le droit de créer un compte staff.

## Rôle staff

Pour un compte staff, **Rôle staff** liste les rôles plateforme que vous avez le droit d'attribuer ; le rôle Observateur est présélectionné s'il est disponible.

## Lier à une organisation (optionnel)

Pour un compte client : **Organisation** (**Aucune** par défaut, parmi les organisations non archivées) puis, si une organisation est choisie, **Rôle dans l'organisation** (parmi les rôles que vous pouvez attribuer dans cette organisation ; le rôle OWNER est présélectionné s'il est disponible).

## Valider

Un message rappelle que l'utilisateur recevra un e-mail avec un lien setup-password valable 24 h. **Créer et inviter** reste inactif tant que l'e-mail et le nom ne sont pas renseignés (et, pour un compte staff, tant qu'aucun rôle n'est choisi) ; une fois le compte créé, vous arrivez sur sa fiche. **Annuler** revient à la liste. En cas d'échec : « Erreur à la création. »
