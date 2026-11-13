---
route: /event/[eventId]/members
title: Membres
audience: organisateur
access: event.members.manage
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/members/page.tsx
  - src/components/event/MemberInviteForm.tsx
  - src/components/event/MemberTable.tsx
  - src/components/permissions/RoleSelect.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:64884eb80530a1082c980cae9835ad5278dc3d33d7b6254a792e1027c6e7ab72
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste l'équipe de l'évènement et ses rôles : vous pouvez inviter des membres, changer leur rôle et les retirer. La liste est paginée.

## Inviter un membre

Le bouton **Inviter** ouvre la fenêtre **Inviter un membre** :
- **Email** (obligatoire) ;
- **Nom (optionnel si l'utilisateur existe)** ;
- le sélecteur de rôle, parmi les rôles que vous pouvez attribuer (Opérateur par défaut lorsqu'il est attribuable) ; un rôle que vous ne pouvez pas attribuer est grisé avec sa raison.

**Inviter** envoie l'invitation (« Invitation envoyée. »). Si la personne est déjà membre, le champ e-mail affiche « Cet utilisateur est déjà membre de l'événement. »

## Le tableau

Colonnes : **Membre** (nom et e-mail), **Rôle**, **Depuis** (date d'ajout) et une colonne d'actions. Sans membre, l'écran affiche « Aucun membre ».

- Le sélecteur de la colonne Rôle change le rôle du membre (« Rôle mis à jour. »). En cas d'échec, la liste se recharge et retrouve la valeur enregistrée (« Échec du changement de rôle. »).
- La corbeille (« Retirer ») retire le membre après confirmation (« Retirer … ? »), puis affiche « Membre retiré. »
