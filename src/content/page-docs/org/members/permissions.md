---
route: /org/[orgId]/members/[userId]/permissions
title: Permissions d'un membre
audience: organisateur
access: org.members.permissions.manage
sources:
  - src/app/org/[orgId]/members/[userId]/permissions/page.tsx
  - src/components/permissions/UserPermissionsEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:aa2bf88ea6d46770fd030f801985d13f6ba8a1e869766741c42e0c1867d41b78
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran ajuste, pour un membre précis, les permissions héritées de son rôle. Les ajustements s'appliquent à l'organisation et à tous ses évènements. Le nom et l'adresse e-mail du membre figurent en en-tête, et le lien **Membres** ramène à la liste.

Vous ne pouvez pas ajuster vos propres permissions, ni celles d'un autre propriétaire (sauf droit plateforme) : vous êtes alors renvoyé à la liste des membres.

## Le rôle du membre

Le nom de l'organisation et le rôle du membre sont rappelés au-dessus de la matrice.

## La matrice des permissions

Les permissions sont regroupées par domaine. Pour chacune :
- le libellé et l'état **Effectif** ou **Non effectif** (résultat après ajustements) ;
- un sélecteur « Ajustement » à trois valeurs : **Hérité** (comportement du rôle, par défaut), **Ajouté** (accorde la permission) et **Retiré** (la retire).

Vous ne pouvez ajouter que des permissions que vous détenez vous-même : les autres affichent « (non détenue) » et ne sont pas sélectionnables.

Le bouton **Enregistrer** applique les ajustements (« Permissions enregistrées. »).
