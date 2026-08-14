# Spec v4 — Propagation du profil aux inscriptions en attente

> **Statut** : conception validée — 2026-08-14 — **à implémenter**
> **Type** : règle métier (assouplissement du gel des snapshots) + correctif d'affichage
> **Périmètre** : v4
> **Dépend de** : [`2026-08-07-08-…validation-documents-staff-plateforme`](2026-08-07-08-v4-validation-documents-staff-plateforme.md) et [`2026-08-11-09-…parcours-court-inscription`](2026-08-11-09-v4-parcours-court-inscription.md)
> **Source** : demande utilisateur du 2026-08-14, à partir d'un constat terrain

## Contexte et objectifs

Une inscription fige l'identité du participant au moment de sa création : les colonnes
`snapshot*` de `Registration` sont remplies par `buildRegistrationSnapshot()`
(`src/lib/participant-profile.ts`) et ne sont réécrites qu'à un seul endroit — la
resoumission d'une inscription `REJECTED` (`src/app/api/account/registrations/[id]/resubmit/route.ts`).

Ce gel total produit une impasse observable : un participant qui corrige son profil
(nouvelle photo, pièce remplacée, structure mise à jour) voit son inscription **en attente**
conserver indéfiniment les anciennes valeurs. Si la référence de départ est cassée — cas
constaté sur une base seedée, dont les `snapshotPhoto` pointent vers des clés
`uploads/profile/seed/…` absentes du stockage S3 — le participant n'a **aucun moyen** de la
réparer : son badge sort avec le rectangle gris de repli, et l'organisation ne voit pas sa
photo. Le dossier reste dans cet état tant que l'organisation ne le rejette pas.

Le gel garde pourtant tout son sens une fois l'inscription approuvée : le badge émis, le QR
vérifié et l'historique doivent refléter l'identité au moment de la décision. L'objectif est
donc de **restreindre le gel aux inscriptions validées** et de laisser les inscriptions en
attente suivre le profil.

La spec traite au passage un second constat de la même session : la carte « Pièces fournies »
du détail d'inscription côté organisation présente un encart « Pièce d'identité » qui se lit
comme un fichier consultable alors que le document n'est, par conception, jamais servi à
l'organisation.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Déclencheur | **Toute modification du profil** (`PUT /api/account/profile`) | Seul point d'entrée qui écrit les champs de profil participant : l'upload ne fait que déposer un fichier et rendre sa clé, et la route staff `platform/users/[userId]` ne touche pas ces champs. Un ancrage unique, donc une règle unique. |
| Portée | Inscriptions **`PENDING` uniquement** | Arbitrage utilisateur du 2026-08-14 : une inscription validée ne peut plus changer. `REJECTED` garde son flux de resoumission, qui réécrit déjà le snapshot et repasse en `PENDING`. |
| Événements archivés | **Exclus** | Un événement archivé est un dossier clos ; le réécrire n'a pas de sens et rouvrirait une donnée gelée. |
| Champs propagés | **Tout le snapshot**, recalculé par `buildRegistrationSnapshot()` | Une seule fonction construit déjà le snapshot ; en dériver une variante partielle créerait deux définitions de la même chose. `snapshotEmail` est inclus mais ne bouge jamais : l'e-mail n'est pas éditable (`src/app/api/account/profile/route.ts:12-14`). |
| Numéro de pièce bloqué | **L'inscription concernée est sautée**, les autres sont mises à jour | Arbitrage utilisateur du 2026-08-14. À la création d'inscription, un `BlockedDocument` (plateforme ou propre à l'événement) est rédhibitoire (`src/app/api/events/[slug]/register/route.ts:128-136`) ; propager sans ce contrôle ferait entrer après coup un numéro que l'événement a explicitement bloqué. |
| Traçabilité | **Une entrée d'audit par inscription touchée** | Arbitrage utilisateur du 2026-08-14. Un valideur qui a consulté un dossier hier doit pouvoir constater qu'il a changé. Pas d'e-mail : un participant qui retouche son profil plusieurs fois en produirait autant. |
| Idempotence | Aucune écriture ni log **si rien ne change** | Le `PUT` du profil est appelé pour des champs sans effet sur le snapshot ; le journal ne doit pas se remplir d'entrées vides. |
| Gestion d'erreur | **Pas de `catch` silencieux** : l'échec remonte en 500 | Le profil est déjà enregistré à ce stade et l'opération est idempotente : réessayer répare. Avaler l'erreur masquerait un bug de propagation, invisible jusqu'à l'impression d'un badge. |
| Emplacement | Nouveau module `src/lib/registration-snapshot-sync.ts` | `participant-profile.ts` reste un module de calcul pur (complétion, construction de snapshot). La synchronisation lit des inscriptions, des événements et des blocages : ce sont deux responsabilités distinctes. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Résolution dynamique à la lecture (ne plus stocker de snapshot pour les inscriptions en attente) | Non retenue | Supprimerait la classe de bugs entière, mais casserait le contrat de `toRegistrationListDTO`, la vérification publique et l'export, et obligerait à distinguer partout « inscription figée » et « inscription vivante ». Coût sans rapport avec le problème. |
| Propagation différée par file de travaux | Non retenue | Le projet n'a aucune infrastructure de job ; en introduire une pour un traitement de quelques millisecondes est du YAGNI. |
| Propagation à l'approbation du profil par la plateforme plutôt qu'à la modification | Non retenue | Écartée le 2026-08-14 : une correction de nom ou de structure ne déclenche aucune revalidation (`submitProfile()` ne compare que les pièces) et n'arriverait donc jamais jusqu'à l'inscription. |
| Propager quand un numéro de pièce est bloqué, en laissant l'organisation rejeter | Non retenue | Rendrait le blocage contournable après coup. |
| Propager puis rejeter automatiquement l'inscription | Non retenue | Ferait prendre par le système une décision de rejet qui appartient à l'organisation. |

## Architecture cible

### Module de synchronisation

`src/lib/registration-snapshot-sync.ts` :

```ts
export type SnapshotRefreshOutcome =
  | {
      registrationId: string;
      eventId: string;
      orgId: string;
      outcome: "refreshed";
      fields: string[];
    }
  | {
      registrationId: string;
      eventId: string;
      orgId: string;
      outcome: "skipped_document_blocked";
    };

export async function refreshPendingRegistrationSnapshots(
  userId: string,
): Promise<SnapshotRefreshOutcome[]>;
```

Déroulé :

1. Charger le profil. S'il est incomplet (`isParticipantProfileComplete()` faux), retourner
   un tableau vide — garde défensive : un profil complet ne peut pas redevenir incomplet,
   le schéma de mise à jour refusant les valeurs vides.
2. Construire le snapshot cible avec `buildRegistrationSnapshot()`.
3. Sélectionner les inscriptions `PENDING` du participant dont l'événement n'est pas
   archivé, avec l'`orgId` de l'événement.
4. Pour chacune : calculer les champs réellement modifiés. Aucun → passer à la suivante,
   sans écriture ni log.
5. Si `snapshotIdDocumentNumber` fait partie des champs modifiés, chercher un
   `BlockedDocument` sur le nouveau numéro avec `eventId = null` **ou** l'`eventId` de
   l'inscription. Trouvé → `skipped_document_blocked`, aucune écriture.
6. Sinon, écrire le snapshot et retourner `refreshed` avec la liste des champs.

La requête de blocage n'est émise que si le numéro a changé.

### Audit

Nouvelle valeur `REGISTRATION_SNAPSHOT_REFRESHED` dans l'enum `ActivityType`
(`prisma/schema.prisma`), avec son libellé dans `src/lib/activity-labels.ts`.

Le journal est écrit **par la route**, qui boucle sur les résultats rendus par le module :
c'est le pattern du projet, et seul le handler dispose de la `NextRequest` dont
`logActivity()` tire l'adresse IP et l'agent. Le module reste ainsi sans dépendance à la
couche HTTP.

Une entrée `logActivity()` par inscription touchée : `userId` = le participant,
`targetId` = l'inscription, `eventId` et `orgId` renseignés pour que le journal de
l'organisation la fasse apparaître, et `details` portant soit
`{ outcome: "refreshed", fields: [...] }`, soit `{ outcome: "skipped_document_blocked" }`.

Un seul type d'action plutôt que deux : le journal reste lisible sans gonfler l'enum, et
`activity-labels.ts` distingue les deux cas à l'affichage.

### Point d'appel

`PUT /api/account/profile` (`src/app/api/account/profile/route.ts`), après
`submitProfile(session.id)`. L'ordre importe : le profil est enregistré, la soumission de
pièces est créée si nécessaire, puis les inscriptions en attente sont réalignées sur l'état
final du profil.

## Correctif au passage — pièce d'identité côté organisation

`src/components/event/RegistrationDetailPanel.tsx`, carte « Pièces fournies » :

- le staff plateforme continue de voir l'aperçu réel de la pièce, comportement inchangé
  (`idDocumentReadable`) ;
- pour tout autre utilisateur, l'encart `FileBox` « Pièce d'identité » disparaît. La carte
  ne présente plus que la photo et prend le titre « Photo » ;
- le statut de vérification (« vérifiée par la plateforme le … », « en attente de
  vérification », « refusée ») rejoint la carte d'informations au-dessus, sous forme de
  ligne de données.

La règle d'accès elle-même n'est pas touchée : `canRead()`
(`src/app/api/files/[...path]/route.ts:29-41`) reste la source de vérité, et le principe
posé par `docs/v4/features/validation-profils.md` — l'organisation approuve sans juger les
documents — est confirmé. Seul l'affichage cesse de suggérer un document consultable.

## Tests

**Module** (`src/lib/__tests__/registration-snapshot-sync.test.ts`, politique de tests
section 1 : couverture 100 % exigée). Comme les autres modules `src/lib` qui touchent
Prisma — `subscription.ts`, `auth-guards.ts` — les tests s'appuient sur la **vraie base**
avec le reset global de `src/test-setup.ts` ; la fonction lit trois tables et une règle de
blocage, la mocker ne prouverait rien :

- une inscription `PENDING` est réalignée sur le nouveau profil ;
- une inscription `APPROVED` et une inscription `REJECTED` restent inchangées ;
- une inscription `PENDING` sur un événement archivé reste inchangée ;
- numéro de pièce bloqué par l'événement : cette inscription est sautée, une autre
  inscription `PENDING` du même participant est bien mise à jour ;
- numéro de pièce bloqué au niveau plateforme : inscription sautée ;
- second appel sans modification : aucune écriture, aucune entrée d'audit ;
- profil incomplet : aucune inscription touchée.

**Intégration API** : `PUT /api/account/profile` avec une nouvelle photo répercute la
valeur jusqu'à `snapshotPhoto` de l'inscription en attente, et écrit l'entrée d'audit.

**E2E** : le participant remplace sa photo, puis l'organisation voit la nouvelle photo sur
le détail de l'inscription en attente. Sur cette même page, la pièce d'identité n'apparaît
pas pour un membre d'organisation.

## Documentation impactée

- `docs/v4/architecture.md` — la règle des snapshots : figés à l'approbation, suivis du
  profil tant que l'inscription est en attente.
- `docs/v4/features/validation-profils.md` — mention de la propagation dans le cycle de vie
  du profil, et de ce que l'organisation voit désormais sur le détail d'inscription.
