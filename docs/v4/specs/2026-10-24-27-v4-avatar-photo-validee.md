# Spec v4 — Photo validée affichée comme avatar

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : évolution d'affichage
> **Périmètre** : v4 — en-têtes des espaces `/account`, `/platform`, `/org/[orgId]`, `/event/[eventId]`
> **Plan** : [`plans/2026-10-24-avatar-photo-validee.md`](../plans/2026-10-24-avatar-photo-validee.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md) — contrat C3 (`UserAvatar`)
> **Source** : `Todo.md` du 2026-10-24, point 4

## Contexte

Les en-têtes affichent une pastille avec les **initiales** de l'utilisateur (quatre
fonctions `initials()` dupliquées, regroupées par le socle dans `UserAvatar`). Le
participant téléverse une photo d'identité dans son profil ; le staff plateforme la
valide (`ProfileSubmission`, `User.profileStatus`). Cette photo sert aux badges.

## Objectif

Une fois le **profil validé** par le staff, la photo de l'utilisateur devient son
**avatar** dans l'interface, à la place des initiales.

## Conception

- La photo affichée est celle de la **dernière `ProfileSubmission` au statut `APPROVED`**,
  et non `User.photo` directement : si l'utilisateur soumet une nouvelle photo, l'avatar
  ne change qu'une fois cette nouvelle photo validée. Sans soumission approuvée →
  initiales.
- `UserAvatar` (contrat C3) affiche la photo en cercle (`object-cover`) quand `photoUrl`
  est fourni, sinon les initiales. Si l'image ne charge pas, repli sur les initiales.
- Résolution de l'URL : **même mécanisme que les badges**, soit
  `/api/files/<clé de la photo de la soumission approuvée>`. Aujourd'hui,
  `src/app/api/files/[...path]/route.ts` sert les photos de profil
  (`profile/<id>/photos/…`) **sans contrôle d'accès**, avec un cache public. Ce chantier ne
  change pas cette règle : les rendre privées toucherait aux badges, à la revue staff et
  aux pages publiques. *Choix de conception à relire* ; un durcissement éventuel fera
  l'objet d'une spec dédiée.
- `photoUrl` est calculé dans les `layout.tsx` des quatre espaces (`src/app/platform`,
  `src/app/org/[orgId]`, `src/app/event/[eventId]`, `src/app/account`), puis passé aux
  gabarits, qui le transmettent déjà à `UserAvatar` grâce au socle (contrat C3). **Ce
  chantier ne modifie pas les gabarits.**
- `UserAvatar` est un composant client (repli `onError`).
- Le comportement s'applique à **tout utilisateur** ayant un profil approuvé, y compris
  un membre du staff ou d'une org qui est aussi participant.

## Critères d'acceptation

- Profil non soumis, en attente ou rejeté **sans soumission approuvée antérieure** :
  initiales.
- Photo approuvée puis nouvelle soumission rejetée : l'avatar reste l'ancienne photo
  validée (règle « dernière soumission `APPROVED` »).
- Profil approuvé : la photo validée apparaît dans l'en-tête de tous les espaces
  accessibles à l'utilisateur.
- Nouvelle photo soumise en attente : l'avatar reste l'ancienne photo validée.
- L'avatar apparaît aussi dans les gabarits opérateur, imprimeur et lecteur de
  l'évènement (ajoutés par le socle).
- Couverture 100 % maintenue sur le helper de résolution ; vérification navigateur.
