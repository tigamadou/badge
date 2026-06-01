# ADR — Scope plateforme pour BlockedEmail / BlockedDocument

> **Statut** : proposition (en attente de validation pour intégration au plan v2-14)
> **Date** : 2026-06-01
> **Type** : décision design (suite audit `docs/v2/audit-implementation-2026-06-01.md` §2.8)
> **Périmètre** : v2
> **Specs liées** :
> - [v2-11 Comptes participants](2026-05-31-v2-11-comptes-participants.md) — §1.3 exige la vérification à register / mise à jour profil
> - [v2-04 Espace Événement](../features/espace-evenement.md) — blocages event-scoped existants

## 1. Contexte

L'audit du 2026-06-01 (§2.8, manques 1 et 2) constate :

- La spec v2-11 §1.3 et le critère d'acceptation C8 demandent :
  - À la **création de compte** (`POST /api/auth/register`), refuser si l'email est dans `BlockedEmail`.
  - À la **complétion / mise à jour du profil** (`PUT /api/account/profile`), refuser si `idDocumentNumber` est dans `BlockedDocument`.
- Le schéma Prisma actuel :
  ```prisma
  model BlockedEmail {
    eventId String  // NOT NULL
    email   String
    @@unique([eventId, email])
  }
  model BlockedDocument {
    eventId        String  // NOT NULL
    documentNumber String
    @@unique([eventId, documentNumber])
  }
  ```
- Conséquence : `eventId` est obligatoire → impossible de représenter un blocage plateforme. La vérification globale exigée par la spec **est structurellement impossible**.
- L'implémentation actuelle a contourné en plaçant la vérification dans `POST /api/events/[slug]/register` (au moment de l'inscription event). Cela ferme la porte trop tard : un banni peut créer un compte, remplir son profil, choisir une catégorie, puis se faire rejeter.

## 2. Options envisagées

### Option A — Ajouter un scope plateforme via `eventId` nullable *(retenue)*

- `BlockedEmail.eventId String?` (nullable).
- `BlockedDocument.eventId String?` (nullable).
- `eventId = NULL` ⇒ blocage **plateforme** (par staff).
- `eventId = "abc"` ⇒ blocage **event-scoped** (par admin event, comportement actuel préservé).

**Vérifications** :
- `POST /api/auth/register` : `findFirst({ email, eventId: null })` → refuser si match.
- `PUT /api/account/profile` : `findFirst({ idDocumentNumber, eventId: null })` → refuser si match.
- `POST /api/events/[slug]/register` : `findFirst({ email, eventId: { in: [null, eventId] } })` → refuser si match (cumule plateforme + event).

**Qui peut bloquer où ?**
- Blocage plateforme (`eventId = NULL`) : staff `STAFF_SUPPORT+` (action exceptionnelle pour abus avéré, ex. spam massif, identité usurpée).
- Blocage event-scoped (`eventId ≠ NULL`) : admin event `ADMIN` (déjà en place).

**Pour / contre** :
- ✓ Couvre les deux besoins réels (event + plateforme).
- ✓ Migration additive non-destructive (`eventId` devient nullable, données existantes restent valides).
- ✓ Pas de modèle séparé à maintenir.
- ⚠ Sémantique « NULL = plateforme » à documenter clairement pour éviter les confusions futures.
- ⚠ MySQL InnoDB traite plusieurs `NULL` comme distincts dans une contrainte `UNIQUE` ⇒ rien ne garantit qu'un même email n'est bloqué qu'une fois au niveau plateforme. À gérer côté applicatif (`findFirst` avant insert + log si doublon).

### Option B — Maintenir event-only, adapter la spec

- Pas de migration. La spec v2-11 §1.3 est mise à jour pour supprimer la vérification register/profil. La seule vérification reste à l'inscription event.
- ✓ Aucun travail technique.
- ✗ Perd un cas d'usage réel (bannissement plateforme pour abus avéré).
- ✗ UX dégradée : le banni découvre son rejet après avoir rempli son compte + profil.
- ✗ Contradiction implicite avec l'esprit du critère C8.

### Option C — Modèle séparé `PlatformBlockedEmail` / `PlatformBlockedDocument`

- Deux nouvelles tables, distinctes des `BlockedEmail` / `BlockedDocument` event-scoped.
- ✓ Sémantique claire (modèles distincts, pas de NULL ambigu).
- ✗ Duplication : deux modèles pour le même concept logique.
- ✗ Plus de routes à maintenir, plus de schémas Zod.

## 3. Décision

**Option A retenue** : ajouter `eventId` nullable, NULL = plateforme.

Raisons :
1. Migration minimale, non-destructive.
2. Un seul modèle par concept (DRY).
3. Les routes existantes (event-scoped) restent inchangées dans leur sémantique : un `eventId` non-NULL vaut blocage event.
4. Les requêtes plateforme et cumulées restent simples (Prisma `findFirst` avec `eventId: null` ou `in: [null, X]`).

## 4. Impact

### 4.1 Schéma Prisma
- `BlockedEmail.eventId` : `String?` (était `String`).
- `BlockedDocument.eventId` : `String?` (était `String`).
- Conserver `@@unique([eventId, email])` et `@@unique([eventId, documentNumber])` (multi-NULL toléré par MySQL ; check applicatif requis pour les blocages plateforme).
- Ajouter `@@index([email])` et `@@index([documentNumber])` pour accélérer les `findFirst` globaux.

### 4.2 Routes à modifier
- `POST /api/auth/register` (`src/app/api/auth/register/route.ts`) : ajouter check `findFirst({ email, eventId: null })`.
- `PUT /api/account/profile` (`src/app/api/account/profile/route.ts`) : ajouter check `findFirst({ idDocumentNumber, eventId: null })`.
- `POST /api/events/[slug]/register` : passer le filtre `eventId` à `{ in: [null, eventId] }` au lieu de `eventId`.

### 4.3 Routes à créer
- `POST /api/staff/blocked-emails` / `GET` / `DELETE /[id]` (gestion blocage plateforme, `STAFF_SUPPORT+`).
- `POST /api/staff/blocked-documents` / `GET` / `DELETE /[id]` (idem).
- Page `/staff/blocked-emails` et `/staff/blocked-documents` (gestion UI).

### 4.4 Audit
- Nouveaux `ActivityType` : `PLATFORM_BLOCKED_EMAIL_ADDED`, `PLATFORM_BLOCKED_EMAIL_REMOVED`, `PLATFORM_BLOCKED_DOCUMENT_ADDED`, `PLATFORM_BLOCKED_DOCUMENT_REMOVED`. `staffActor = true`.

### 4.5 Erreurs HTTP
- HTTP 403 `EMAIL_BLOCKED` (à register) — message générique anti-énumération.
- HTTP 403 `DOCUMENT_BLOCKED` (à update profil) — idem.
- À l'inscription event, conserver les codes existants (`EMAIL_BLOCKED`, `DOCUMENT_BLOCKED`) avec le même message.

## 5. Migration

```sql
ALTER TABLE BlockedEmail MODIFY eventId VARCHAR(191) NULL;
ALTER TABLE BlockedDocument MODIFY eventId VARCHAR(191) NULL;
CREATE INDEX BlockedEmail_email_idx ON BlockedEmail(email);
CREATE INDEX BlockedDocument_documentNumber_idx ON BlockedDocument(documentNumber);
```

Géré via `prisma db push` (cohérent avec la stratégie de schéma actuelle, cf. ADR `2026-05-28-v2-master-design.md`).

## 6. Critères d'acceptation

- [ ] `POST /api/auth/register` refuse 403 si email présent dans `BlockedEmail` avec `eventId = NULL`.
- [ ] `PUT /api/account/profile` refuse 403 si `idDocumentNumber` présent dans `BlockedDocument` avec `eventId = NULL`.
- [ ] `POST /api/events/[slug]/register` refuse 403 si email/document bloqué soit au niveau plateforme soit pour cet event.
- [ ] Une org peut continuer à bloquer pour ses events sans impact plateforme.
- [ ] Staff `STAFF_SUPPORT+` peut ajouter / lever un blocage plateforme via `/staff/blocked-emails` et `/staff/blocked-documents`.
- [ ] Toute action de blocage / déblocage plateforme est tracée dans `ActivityLog` avec `staffActor = true`.
- [ ] Les blocages existants (avec `eventId` non-NULL) continuent de fonctionner sans changement de comportement.
