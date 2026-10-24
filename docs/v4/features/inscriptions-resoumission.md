# Resoumission d'une inscription rejetée, avec changement de catégorie

> **Statut : livré** — spec [25 — catégorie d'inscription rejetée](../specs/2026-10-24-25-v4-categorie-inscription-rejetee.md) · plan [catégorie d'inscription rejetée](../plans/2026-10-24-categorie-inscription-rejetee.md) · coordination : [spec 22](../specs/2026-10-24-22-v4-lot-notifications-coordination.md).

Un participant dont l'inscription est `REJECTED` peut la resoumettre en choisissant une
autre catégorie du même évènement. L'inscription repasse en `PENDING` dans la nouvelle
catégorie, avec un **nouvel ID métier** qui encode le numéro de cette catégorie. Sans
changement de catégorie, la resoumission est inchangée (même ID).

## Parcours participant

Page `/account/registrations/[id]`, bloc affiché pour une inscription rejetée :

1. Le motif de rejet est affiché en premier (`Alert`).
2. Le sélecteur `RadioCards` « Catégorie » liste toutes les catégories de l'évènement (nom +
   pastille de couleur), la catégorie actuelle est cochée.
3. Quand la sélection diffère, le texte « Votre inscription sera resoumise dans la catégorie
   *X*. » apparaît.
4. Le bouton « Resoumettre mon inscription » affiche un loader, puis un toast
   « Inscription resoumise. » (contrat C4 du [socle](lot-notifications-socle.md)).
5. Si l'ID a changé, le client fait `router.replace` vers la **nouvelle URL**
   (`/account/registrations/<nouvelId>`) ; sinon `router.refresh()`.

Le corps `{ categoryId }` n'est envoyé que si la catégorie a changé.

## `POST /api/account/registrations/[id]/resubmit`

Corps JSON **optionnel** : `{ "categoryId": "…" }`. Un corps vide ou `{}` est accepté.

| Statut | Code | Cas |
|---|---|---|
| 200 | — | `{ ok: true, id }` — `id` est le nouvel ID si la catégorie a changé, sinon l'ID inchangé |
| 400 | `INVALID_BODY` | JSON mal formé, `categoryId` non chaîne ou vide |
| 400 | `INVALID_CATEGORY` | catégorie absente de l'évènement de l'inscription (autre évènement, supprimée) |
| 400 | `PROFILE_INCOMPLETE` | profil participant incomplet |
| 403 | `PROFILE_NOT_SUBMITTED` | pièces du profil non déposées / rejetées |
| 403 | `FORBIDDEN` | l'inscription appartient à un autre participant |
| 404 | `NOT_FOUND` | inscription ou utilisateur introuvable |
| 409 | `INVALID_STATE` | inscription non `REJECTED` (y compris avec un `categoryId`), ou déjà resoumise par une requête concurrente |

Un `categoryId` égal à la catégorie actuelle se comporte comme l'absence de `categoryId`.

### Transaction et concurrence

Le nouvel ID, le changement de catégorie, le snapshot réécrit et le passage en `PENDING`
sont **une seule écriture** (`updateMany` conditionné sur `{ id, status: "REJECTED" }`) dans
une transaction. Aucune clé étrangère ne référence `Registration.id`, la clé primaire peut
donc changer. Si deux requêtes se croisent, la seconde obtient `count === 0` et reçoit 409.
Une collision d'ID persistante après les nouvelles tentatives remonte l'erreur Prisma et rien
n'est modifié.

## Régénération de l'ID

`allocateRegistrationId(tx, { eventId, eventDate, categoryId, categoryNumber })`
(`src/lib/registration-id.ts`), partagé avec `POST /api/events/[slug]/register` :

- séquentiel = nombre d'inscriptions de l'évènement dans la **nouvelle** catégorie + 1 ;
- format de `generateId` : le dernier chiffre du numéro de catégorie figure au **1er et au
  10e caractère** de l'ID ; la date de l'évènement occupe les caractères 2 à 7 ;
- jusqu'à 5 nouvelles tentatives en cas de collision.

La route staff de création d'inscription (`api/org/.../registrations`) génère toujours son
ID de son côté et n'utilise pas ce helper.

## Journal d'activité et email

`REGISTRATION_RESUBMITTED` est journalisé avec `targetId` = **nouvel ID**. Quand la catégorie
change, `details` contient :

```ts
{
  categoryChanged: { from: { id, name }, to: { id, name } },
  idChanged: { from: ancienId, to: nouvelId },
  changes: { "Catégorie": { from, to }, "Identifiant": { from, to } }, // lu par extractDiff()
}
```

Sans changement de catégorie, aucun `details`. Les entrées d'`ActivityLog` **antérieures**
conservent l'ancien `targetId` (l'historique n'est pas réécrit).

`sendRegistrationResubmitted(id, { previousCategoryName? })` ajoute le paragraphe « Votre
inscription a été transférée de la catégorie *A* vers la catégorie *B*. » et le lien pointe
vers le nouvel ID.

## Conséquences sur les URL et les liens

L'ancienne URL `/account/registrations/<ancienId>` renvoie une 404. Les liens de
notifications qui pointeraient vers l'ancien ID sont réécrits par `rewriteNotificationLinks`,
qui relève de la [spec 24](../specs/2026-10-24-24-v4-notifications.md) : ce chantier n'y
touche pas, le chantier 24 ajoutera l'appel dans la transaction de `resubmit`.

## Rejet interdit après impression du badge

Décision du 2026-10-24 : une inscription avec `badgePrinted = true` ne peut plus être rejetée.
`POST /api/org/[orgId]/events/[eventId]/registrations/[regId]/reject` répond
`409 { error: "BADGE_ALREADY_PRINTED" }` sans rien modifier. Dans la fiche d'inscription de
l'espace évènement, le texte « Badge imprimé : cette inscription ne peut plus être rejetée. »
est affiché pour une inscription approuvée dont le badge est imprimé.
