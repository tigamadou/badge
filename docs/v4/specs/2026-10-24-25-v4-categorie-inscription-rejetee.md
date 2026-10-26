# Spec v4 — Changer la catégorie d'une inscription rejetée

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : évolution du parcours de resoumission
> **Périmètre** : v4 — espace `/account`, route `api/account/registrations/[id]/resubmit`
> **Plan** : [`plans/2026-10-24-categorie-inscription-rejetee.md`](../plans/2026-10-24-categorie-inscription-rejetee.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md)
> **Source** : `Todo.md` du 2026-10-24, point 2

## Contexte

Un organisateur peut rejeter une inscription parce que le participant a choisi la
**mauvaise catégorie** (ex. « Presse » au lieu de « Exposant »). Le participant peut déjà
**resoumettre** une inscription rejetée (`ResubmitButton` sur
`/account/registrations/[id]`, route `POST api/account/registrations/[id]/resubmit`),
mais la resoumission ne fait que réaligner le profil et repasser l'inscription en
`PENDING` : la catégorie reste la même, et le participant doit refaire une inscription.

## Objectif

Lors de la resoumission d'une inscription **rejetée**, le participant peut **choisir une
autre catégorie** de l'évènement.

## Non-objectifs

- Changer la catégorie d'une inscription `PENDING` ou `APPROVED`.
- Permettre à l'organisateur de changer lui-même la catégorie (il rejette avec un motif).

## Conception

### Interface (`/account/registrations/[id]`)

- Pour une inscription `REJECTED`, le bloc de resoumission affiche, au-dessus du bouton,
  un sélecteur de catégorie (composant `RadioCards` ou `Select` existant) **pré-rempli
  avec la catégorie actuelle**, listant toutes les catégories de l'évènement (nom +
  pastille de couleur).
- Le motif de rejet reste affiché au-dessus, pour que le participant comprenne quoi
  corriger.
- Le bouton garde son libellé (« Resoumettre ») ; si la catégorie a changé, un texte
  d'aide indique « Votre inscription sera resoumise dans la catégorie *Exposant*. »
- Bouton avec loader et toast via les primitives du socle (contrat C4).

### API

`POST api/account/registrations/[id]/resubmit` accepte un corps JSON **optionnel** :

```json
{ "categoryId": "…" }
```

- Absent ou identique : comportement actuel inchangé (compatibilité).
- Présent et différent : la catégorie doit appartenir **au même évènement** (sinon 400
  `INVALID_CATEGORY`). Le corps est validé avec Zod, comme dans `register/route.ts`. La
  route n'a pas de corps aujourd'hui : un corps vide ou absent doit rester accepté.
- La mise à jour de la catégorie et le passage en `PENDING` se font dans **une seule
  transaction**.
- `logActivity` `REGISTRATION_RESUBMITTED` reçoit dans `details` l'ancienne et la
  nouvelle catégorie (`{ categoryChanged: { from: { id, name }, to: { id, name } } }`) ;
  la notification de resoumission (spec 24) s'appuie sur ces `details` pour mentionner
  le changement.
- L'email `sendRegistrationResubmitted` mentionne la nouvelle catégorie le cas échéant.

### Rejet interdit après impression du badge

**Décision de l'utilisateur (2026-10-24)** : une inscription dont le badge est imprimé
(`badgePrinted = true`) **ne peut plus être rejetée** par le parcours normal. La route
`POST api/org/[orgId]/events/[eventId]/registrations/[regId]/reject` répond
**409 `BADGE_ALREADY_PRINTED`** sans rien modifier, et le bouton « Rejeter » n'est pas
proposé dans l'interface pour ces inscriptions. Conséquence : le changement de catégorie
(et donc la régénération d'ID) ne concerne jamais un badge déjà imprimé.

### ID métier de l'inscription

L'ID de l'inscription (clé primaire, imprimé sur le badge et dans le QR code) **encode le
numéro de catégorie** (`src/lib/generate-id.ts` : premier et dixième chiffres =
dernier chiffre de `category.number`, suivi d'un séquentiel par catégorie).

**Décision de l'utilisateur (2026-10-24)** : **régénérer l'ID** quand la catégorie
change, avec les règles de `register/route.ts` (séquentiel de la nouvelle catégorie,
retry en cas de collision). La génération d'ID, aujourd'hui inline dans
`register/route.ts`, est extraite dans un helper de `src/lib` partagé par les deux routes.
Le changement d'ID se fait dans la même transaction que le changement de catégorie.

**Notifications** : les notifications déjà émises pour cette inscription (spec 24)
pointent vers l'ancien ID. Le chantier 24 fournit un helper
`rewriteNotificationLinks(oldId, newId, tx)`, que la route `resubmit` appelle. Si 25 est
fusionné avant 24 (ordre prévu), c'est 24 qui ajoute cet appel dans `resubmit` en se
rebasant. Aucun modèle ne référence `Registration.id` par
clé étrangère ; seules les entrées d'`ActivityLog` antérieures gardent l'ancien
`targetId` (historique conservé, l'entrée `REGISTRATION_RESUBMITTED` porte l'ancien et le
nouvel ID dans `details`). L'URL `/account/registrations/[id]` change : la réponse renvoie
le nouvel ID et l'interface redirige vers la nouvelle URL.

## Critères d'acceptation

- Inscription rejetée : le participant choisit une autre catégorie, resoumet ; l'inscription
  est `PENDING` dans la nouvelle catégorie, visible comme telle par l'organisateur.
- Une `categoryId` d'un autre évènement est refusée (400), sans modification.
- Rejeter une inscription dont le badge est imprimé renvoie 409
  `BADGE_ALREADY_PRINTED`, et l'interface ne propose pas le rejet.
- Une inscription non rejetée ne peut pas changer de catégorie (409, comportement actuel).
- Resoumettre sans changer de catégorie fonctionne comme avant.
- L'historique d'activité montre l'ancienne et la nouvelle catégorie.
- Couverture 100 % maintenue sur la route ; test E2E du parcours rejet → changement →
  resoumission.
