# Spec v4 — Correctifs profil participant & aperçus de documents

> **Statut** : conception validée — 2026-08-07 — **à implémenter**
> **Type** : correctif + brique UI partagée
> **Périmètre** : v4
> **Source** : `Todo.md` items 1, 2, 4

## Contexte et objectifs

Trois symptômes remontés par la recette manuelle, tous autour des données de profil du participant :

1. « Les informations du participant ne sont pas bien transférées lors de son inscription à un événement » — champs vides ou erronés côté staff (liste des inscriptions, détail, badge/export).
2. La photo du participant n'apparaît pas sur la page de détail de son inscription.
3. Dans l'espace compte participant, la photo et la pièce d'identité ne sont pas prévisualisées.

Cette spec établit les causes racines de (1) — déjà identifiées dans le code, sans reproduction nécessaire — et introduit la brique d'aperçu de fichier réutilisée par les specs 07 et 08.

## Causes racines de l'item 1

### Cause A — DTO non aplati dans la liste des inscriptions

`GET /api/org/[orgId]/events/[eventId]/registrations` renvoie les lignes Prisma telles quelles, avec les clés `snapshotFirstName`, `snapshotLastName`, `snapshotEmail`, `snapshotStructure`.

`src/components/event/RegistrationTable.tsx:39` fait `setRows(json.registrations)` alors que son type `Row` déclare `firstName`, `lastName`, `email`, `structure`. Les colonnes **Nom** et **E-mail** du tableau sont donc systématiquement vides.

Pourquoi le typage n'a rien vu : la réponse de `fetch` est `any`, l'assignation à `Row[]` est acceptée sans contrôle.

Pourquoi l'incohérence perçue : deux autres consommateurs aplatissent correctement le DTO — `GET …/badges` (`route.ts:31-32`) et l'export CSV (`export/route.ts:17-20`). Le contrat de sortie est donc défini trois fois, différemment, sans source unique.

### Cause B — Documents de profil inaccessibles aux membres d'organisation

Depuis la v2-11, le participant téléverse sa pièce d'identité depuis son compte : la clé de stockage est `profile/{userId}/documents/…` (`src/lib/storage.ts:61`).

`src/app/api/files/[...path]/route.ts:29-40` classe cette clé comme **sensible** et n'autorise que le propriétaire du fichier ou le **staff plateforme** (`ctx.isStaff`). Un membre d'organisation qui clique « Pièce d'identité → Voir le fichier » sur `RegistrationDetailPanel` reçoit un **403** sans message explicite.

Ce n'est pas un défaut du contrôle d'accès : c'est le comportement voulu, mais l'interface n'en tient pas compte. La spec 08 supprimera d'ailleurs le besoin pour l'org de consulter la pièce (validation déplacée au staff plateforme). En attendant, l'interface doit afficher un état honnête au lieu d'un lien mort.

Les photos (`profile/{userId}/photos/…`) ne sont pas sensibles — elles figurent sur les badges — et restent lisibles par tous.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Contrat de sortie des inscriptions | Helper unique `toRegistrationListDTO()` dans `src/lib/registration-dto.ts`, consommé par la route liste ; DTO **aplati** (`firstName`, pas `snapshotFirstName`) | Un seul endroit définit le contrat. Les trois définitions divergentes actuelles disparaissent. |
| Sens de l'aplatissement | Côté serveur, pas côté client | Le préfixe `snapshot` est un détail de persistance ; il n'a pas à fuiter dans l'API ni dans les composants. Cohérent avec `/badges` et l'export, déjà aplatis. |
| Typage des réponses `fetch` | Type de réponse explicite et parsing typé dans les composants clients concernés | Empêche la réapparition silencieuse du même bug. |
| Aperçu de fichier | Composant partagé `DocumentPreview` (`src/components/ui/`) | Trois consommateurs immédiats (compte participant, détail inscription, modération staff en spec 08). Le seuil YAGNI est franchi. |
| Type de fichier | Déduit de l'extension de la clé de stockage | Le `mime` n'est pas persisté. L'upload contraint déjà les types (JPEG/PNG/WebP/PDF), l'extension est fiable. |
| Pièce d'identité côté org | Remplacée par un état explicite « Vérifiée par la plateforme — non consultable ici » | Un lien qui renvoie 403 est un défaut d'interface. Anticipe le modèle de la spec 08 sans le préempter. |
| Champ vidé dans le profil | Hors périmètre | `ProfileForm` n'envoie que les champs non vides : on peut remplacer une photo, pas la supprimer. Aucun parcours métier ne demande la suppression sèche d'une pièce. |

## Architecture cible

### `src/lib/registration-dto.ts`

```
toRegistrationListDTO(row)  // Prisma select -> { id, firstName, lastName, email, structure,
                            //   status, badgePrinted, allAccessGranted, createdAt, category }
```

Fonction pure, testée unitairement. La route liste l'applique sur chaque ligne ; `RegistrationTable` type sa réponse sur ce DTO.

### `src/components/ui/DocumentPreview.tsx`

```
<DocumentPreview
  storageKey={string | null}
  label="Pièce d'identité"
  readable={boolean}   // défaut true
/>
```

Quatre états :

| État | Rendu |
|---|---|
| Image (`.jpg`, `.jpeg`, `.png`, `.webp`) | Vignette cliquable → visionneuse plein écran |
| PDF (`.pdf`) | Icône document cliquable → visionneuse `iframe` + lien de téléchargement |
| `storageKey` absent | « Non fournie » |
| `readable={false}` | « Vérifiée par la plateforme — non consultable ici » |

Il s'appuie sur `FileBox` existant pour la présentation et sur `/api/files/<key>` pour la source.

### Points de consommation

| Écran | Fichier | Changement |
|---|---|---|
| Compte — profil | `src/app/account/profile/ProfileForm.tsx` | La clé de stockage brute affichée en sous-titre est remplacée par l'aperçu réel (photo et pièce) |
| Compte — détail inscription | `src/app/account/registrations/[id]/page.tsx` | Ajout de `snapshotPhoto` / `snapshotIdDocument` au `select`, nouveau bloc « Pièces fournies » |
| Événement — détail inscription | `src/components/event/RegistrationDetailPanel.tsx` | Photo en aperçu réel ; pièce d'identité en état non consultable |

## Tests

- **Unitaire** : `toRegistrationListDTO` (aplatissement, champs optionnels) ; `DocumentPreview` (quatre états, déduction du type).
- **Intégration** : `GET …/registrations` asservit le contrat de DTO — un retour contenant une clé `snapshot*` fait échouer le test.
- **E2E** : parcours participant complet (profil → inscription → détail, aperçus visibles) ; côté staff, la liste des inscriptions affiche nom et e-mail non vides.

## Impacts documentation

- `docs/v4/README.md` — entrée de plan et état d'avancement.
- `docs/v4/architecture.md` — mention du contrat de DTO des inscriptions.

## Hors périmètre

- Refonte de l'affichage des détails d'un événement → spec 07.
- Validation des documents par le staff plateforme, historique des soumissions, catalogue de motifs de rejet → spec 08.
- Élargissement du contrôle d'accès de `/api/files` aux membres d'organisation : la spec 08 rend la question sans objet.
