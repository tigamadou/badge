# Validation des profils participants (v4 — plan 08)

> Le *pourquoi* et les arbitrages sont dans la spec
> [`../specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md`](../specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md).
> Ce document décrit le *quoi* et le *comment* actuels.

## Principe

L'identité d'un participant (photo + pièce d'identité) est validée **une fois**
par le **staff plateforme**. L'organisation conserve son approbation métier par
événement (catégorie, quota, pertinence), sans juger les documents.

Depuis le plan 09, **déposer ses pièces suffit pour s'inscrire** : le participant
n'attend pas la décision plateforme pour être enregistré. C'est l'**approbation
de l'inscription** par l'organisation qui reste conditionnée à un profil
`APPROVED`. La barrière n'a pas disparu, elle s'est déplacée de l'entrée vers la
sortie — aucun badge n'est émis sans identité vérifiée.

## Cycle de vie du profil

`User.profileStatus` : `INCOMPLETE → PENDING → APPROVED | REJECTED`.

- **INCOMPLETE** : profil incomplet, aucune inscription possible.
- **PENDING** : documents soumis, en attente de décision plateforme. Le
  participant **peut s'inscrire** ; son inscription restera non approuvable
  jusqu'à la décision.
- **APPROVED** : le participant peut s'inscrire, et son inscription peut être
  approuvée par l'organisation.
- **REJECTED** : documents refusés ; toute modification de pièce recrée une
  soumission et repasse en `PENDING`.

Toute modification du profil réaligne les inscriptions **en attente** du participant sur
les nouvelles valeurs ; les inscriptions déjà approuvées restent figées. C'est ce qui
permet à un participant de corriger une photo ou une pièce sans attendre un rejet.

Le champ est un **miroir dénormalisé** de la dernière `ProfileSubmission`. Seul
`src/lib/profile-review.ts` l'écrit (`submitProfile`, `approveProfile`,
`rejectProfile`). Chaque envoi de pièces crée une ligne **immuable** ;
l'historique complet est conservé.

## Catalogue de motifs de rejet

`RejectionReason` (administré dans les paramètres plateforme) : `label`, `scope`
(`PROFILE` | `REGISTRATION` | `BOTH`), `sortOrder`, soft delete `archived`.
Le catalogue alimente le rejet de profil (portée `PROFILE`/`BOTH`) **et** le rejet
d'inscription (portée `REGISTRATION`/`BOTH`). Le libellé est **figé** sur
l'enregistrement au moment de la décision — archiver un motif ne réécrit pas
l'historique.

## Gate d'inscription et gel

- `POST /api/events/[slug]/register`, la resoumission et la création par le staff
  d'org renvoient **403 `PROFILE_NOT_SUBMITTED`** si le profil cible est
  `INCOMPLETE` ou `REJECTED`. Les statuts `PENDING` et `APPROVED` passent
  (`canRegisterToEvent`, `src/lib/profile-review.ts`). La page
  `/e/[slug]/register` redirige vers `/account/profile` dans les mêmes cas.
  Un profil `REJECTED` se débloque en resoumettant ses pièces, ce qui le repasse
  `PENDING`.
- `POST …/registrations/[regId]/approve` renvoie **409 `PROFILE_NOT_APPROVED`**
  tant que le profil n'est pas `APPROVED` (gel des inscriptions `PENDING`). Les
  inscriptions déjà `APPROVED` et les badges imprimés ne bougent pas.

## Rôles

| Action | Rôle minimum |
|---|---|
| Consulter la file d'attente et un profil | `STAFF_OBSERVER` |
| Approuver / rejeter un profil | `STAFF_SUPPORT` |
| Administrer le catalogue de motifs | `STAFF_ADMIN` |

Toutes les décisions sont journalisées (`PROFILE_APPROVED`, `PROFILE_REJECTED`,
`REJECTION_REASON_*`) et notifiées par e-mail au participant
(`sendProfileApproved` / `sendProfileRejected`).

## Points d'API

- `GET /api/platform/profiles?status=&q=` — file d'attente.
- `GET /api/platform/profiles/[userId]` — détail + historique.
- `POST /api/platform/profiles/[userId]/approve` — approbation (`STAFF_SUPPORT`).
- `POST /api/platform/profiles/[userId]/reject` — rejet `{ reasonId, details? }`.
- `GET/POST /api/platform/rejection-reasons`, `PATCH/DELETE …/[id]` — catalogue.
- `GET /api/account/profile` expose `profileStatus` et la soumission courante ;
  `PUT` recrée une soumission dès qu'une pièce change.

## Écrans

- **Plateforme** : `/platform/profiles` (file), `/platform/profiles/[userId]`
  (décision + historique), onglet « Motifs de rejet » dans `/platform/settings`.
- **Participant** : `/account/profile` (bandeau de statut, historique),
  détail d'inscription (alerte de gel).
- **Organisation** : détail d'inscription (photo, ligne « Identité » portant l'état de
  vérification plateforme, bouton Approuver désactivé si profil non validé, rejet via le
  catalogue). La pièce d'identité elle-même n'est jamais affichée à l'organisation.
