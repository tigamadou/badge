# Comptes participants -- Implementation Plan

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [x] | 2026-06-01 | Pre-flight : 98 references legacy inventoriees sur 18 fichiers, services UP, branche feat/v2-implementation (le plan annoncait feat/v2-sass, coquille). |
| 1  | [x] | 2026-06-01 | Schema fusion : User v2 enrichi (champs profil + tokens email/reset + blocked) en preservant isStaff/staffRole/memberships v2-01. Registration refondue (userId + 8 snapshot* + @@unique([userId, eventId])). SubmissionSnapshot supprime. EDIT_LINK_SENT supprime. Nouveaux ActivityType USER_*. db push --force-reset (BDD dev jetable). |
| 2  | [x] | 2026-06-01 | Helpers auth-tokens.ts (generateToken/hashToken/computeExpiry/EMAIL_VERIFY_TTL_MS=24h/PASSWORD_RESET_TTL_MS=1h/isExpired) + participant-profile.ts (isParticipantProfileComplete, buildRegistrationSnapshot, computeParticipantProfileCompletedAt, recomputeParticipantProfileCompletedAt). Tests differes Task 19. |
| 3  | [x] | 2026-06-01 | recaptcha.ts existant suffisant. auth-participant.ts cree (requireAuth, getSessionUser, requireRegistrationOwner, AuthError). |
| 4  | [x] | 2026-06-01 | authorize NextAuth refuse !emailVerifiedAt et blocked. setup-password pose emailVerifiedAt en finalisation d'invitation (pour ne pas bloquer les staff invites). |
| 5  | [x] | 2026-06-01 | mail.ts : ajout sendAccountVerifyEmail(userId, plainToken), sendAccountPasswordReset(userId, plainToken), sendRegistrationResubmitted(registrationId). Suppression sendEditLinkEmail. sendStatusNotification (REJECTED) pointe vers /account/registrations/[id]. Adaptation snapshotEmail/snapshotFirstName/snapshotLastName partout. |
| 6  | [x] | 2026-06-01 | POST /api/auth/register : validation Zod + rate-limit + reCAPTCHA + bcrypt 12 + emailVerifyToken (hash en BDD, plain dans le mail) + sendAccountVerifyEmail + log USER_REGISTERED. Renvoie 201. |
| 7  | [x] | 2026-06-01 | POST /api/auth/verify-email : reponse uniforme INVALID_OR_EXPIRED_TOKEN anti-enumeration. Idempotent (200 alreadyVerified si deja confirme). |
| 8  | [x] | 2026-06-01 | POST /api/auth/forgot-password : toujours 200 anti-enumeration, envoi uniquement si user verifie + non bloque. POST /api/auth/reset-password : passwordResetToken (hash) + bcrypt 12 + clear tokens + log. |
| 9  | [x] | 2026-06-01 | GET + PUT /api/account/profile : sanitize (pas de password/tokens), whitelist Zod (firstName, lastName, structure, photo, idDocumentType, idDocumentNumber, idDocument), recalcul participantProfileCompletedAt, log USER_PROFILE_UPDATED. |
| 10 | [x] | 2026-06-01 | GET /api/account/registrations (liste user courant), GET /api/account/registrations/[id] (403 si autre user), POST .../resubmit (409 si != REJECTED, re-snapshot depuis le user, sendRegistrationResubmitted, log REGISTRATION_RESUBMITTED). |
| 11 | [x] | 2026-06-01 | POST /api/events/[slug]/register : requireAuth + check profil complet (sinon 400 PROFILE_INCOMPLETE) + buildRegistrationSnapshot + @@unique check + BlockedEmail/BlockedDocument check + quota + generateId + log REGISTRATION_CREATED + sendRegistrationConfirmation. |
| 12 | [x] | 2026-06-01 | Pages auth : /register (form + redirect "verifiez votre email"), /verify-email/[token] (Server Component qui POST verify), /forgot-password (anti-enum), /reset-password/[token]. Style aligne sur /login existant. |
| 13 | [x] | 2026-06-01 | Pages compte : /account/layout.tsx (verifie session, redirect /login), /account (liste regs + warning profil incomplet), /account/profile (ProfileForm Client Component), /account/profile/complete (variante guidee avec param `next`), /account/registrations/[id] (detail + ResubmitButton). Plus route /api/account/upload (form-data, kind=photo|document) + accountProfileKey dans storage.ts. |
| 14 | [x] | 2026-06-01 | /e/[slug] refondue : presentation seule + boutons "Se connecter" / "Creer un compte" / "S'inscrire". /e/[slug]/register : nouvelle page (requireAuth + check profil complet sinon redirect /account/profile/complete?next=...). /e/[slug]/success enrichie avec param ?id et liens vers /account. |
| 14.5 | [x] | 2026-06-01 | Playwright 1.60 installe (yarn add -D @playwright/test). playwright.config.ts minimal (chromium uniquement, baseURL localhost:3000, no webServer, locale fr-FR). Cible Makefile test-e2e ajoutee. Execution depuis l'hote (containers app legers). |
| 15-16 | [x] | 2026-06-01 | 4 specs E2E Playwright ecrites et vertes : account-register.spec.ts (3 tests : register form, login refuse non verifie, verify-email + login), account-profile.spec.ts (1 test : edit profile + persistence), event-register-flow.spec.ts (3 tests : CTA non logue, inscription complete + redirect success, redirect /account/profile/complete si profil incomplet), account-resubmit.spec.ts (1 test : resubmit registration REJECTED). Helper e2e/helpers/db.ts avec convention email @v2-11-e2e.test. Chromium Alpine installe dans le container app (apk add). vitest.config.ts exclut e2e/** pour eviter le doublon. Composant `Input` ameliore (label htmlFor genere via useId). ProfileForm omet les chaines vides du PUT. **8/8 E2E verts en 11s.** |
| 17 | [x] | 2026-06-01 | Seed enrichi : SUPER_ADMIN avec emailVerifiedAt (backfill si seede avant v2-11). Nouveau participant participant@badge.local / particip123 avec profil complet (Awa Diallo, Universite FHB, CNI). Idempotent. |
| 18 | [x] | 2026-06-01 | Suppression : /edit-registration/[token], /edit-registration/expired, /api/public/edit-registration/[token]/*, /api/public/events/[slug]/registrations, /api/admin/.../resend-edit-link, /api/admin/.../reset-edit-token, /api/setup-password (legacy), EditRegistrationForm, PublicRegistrationForm. Bouton UI "Renvoyer le lien d'edition" retire de RegistrationDetailPanel. Doc mise a jour : notifications-email.md, inscription-publique.md, multi-tenancy-rbac.md, espace-evenement.md, README v2 (entree v2-11 + v2-12). |
| 19 | [x] | 2026-06-01 | Tests : 9 fichiers existants adaptes (80 tests) + 9 nouveaux fichiers ecrits (57 tests). Total 137 tests v2-11 verts. Fichiers ecrits : auth-tokens.test.ts, participant-profile.test.ts, register.test.ts, verify-email.test.ts, forgot-password.test.ts, reset-password.test.ts, profile.test.ts, registrations.test.ts, register-event.test.ts. Tests legacy supprimes (3) : public-edit, public-e2e, public-registrations. E2E Playwright non livres (cf. Task 15-16). |
| 20 | [x] | 2026-06-01 | Verification finale : tsc --noEmit 0 erreur, vitest 559 tests / 60 fichiers verts, lint 0 erreur (19 warnings pre-existants). Pas de commit. |

**Derniere session** : 2026-06-01, plan **integralement termine** (toutes tasks [x], y compris E2E Playwright).
**Prochaine etape** : v2-12 (templates badges) ou autre.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le mecanisme `editToken` + `SubmissionSnapshot` de v1/v2-05 par un compte participant unifie global (NextAuth Credentials + verification email + reset password) avec snapshot inline des donnees personnelles dans chaque `Registration`, et refondre le flux `/e/[slug]` en consequence.

**Architecture:** Le modele `User` (deja unifie staff + memberships en v2-01) accueille les champs profil participant (photo, document ID, structure) en nullable. Chaque `Registration` snapshote ces champs au moment de la soumission ou d'une resoumission ; l'edition se fait via `/account/profile`. Les routes auth (`/api/auth/register|verify-email|forgot-password|reset-password`) s'ajoutent au `CredentialsProvider` NextAuth existant. La page `/e/[slug]` reste publique (presentation seule), la soumission passe par `/e/[slug]/register` protegee. Toutes les routes API verifient soit `requireParticipantSelf` (compte courant) soit le RBAC existant pour les admins.

**Tech Stack:** Next.js 16 App Router (Server Components par defaut), Prisma 6 + MySQL 8, NextAuth.js Credentials + JWT, bcryptjs 12 rounds, nodemailer (cascade Event -> Org -> Platform via `resolveTransporter`), react-google-recaptcha v3, Vitest 4 (tests d'integration avec vraie BDD MySQL), Playwright (E2E).

**Spec:** [`docs/v2/specs/2026-05-31-v2-11-comptes-participants.md`](../specs/2026-05-31-v2-11-comptes-participants.md)

---

## File Structure

**Files to create:**

- `src/lib/auth-tokens.ts` -- generateurs de tokens (verification email, reset password) + hash/compare, expirations (24h / 1h)
- `src/lib/participant-profile.ts` -- helper `isParticipantProfileComplete(user)` + `recomputeParticipantProfileCompletedAt(userId)` + snapshot helpers `buildRegistrationSnapshot(user)` + `applySnapshotToRegistration`
- `src/lib/auth-participant.ts` -- helper `requireParticipantSelf(req, registrationOrUserId)` + `requireAuth()` (session ou 401)
- `src/lib/recaptcha.ts` -- verification reCAPTCHA v3 partagee (utilisee par register et register-event)
- `src/app/api/auth/register/route.ts` -- POST creation compte
- `src/app/api/auth/verify-email/route.ts` -- POST verification email via token
- `src/app/api/auth/forgot-password/route.ts` -- POST demande reset
- `src/app/api/auth/reset-password/route.ts` -- POST confirmation reset
- `src/app/api/account/profile/route.ts` -- GET + PUT profil participant
- `src/app/api/account/registrations/route.ts` -- GET liste des registrations du user
- `src/app/api/account/registrations/[id]/route.ts` -- GET detail
- `src/app/api/account/registrations/[id]/resubmit/route.ts` -- POST resoumission
- `src/app/api/events/[slug]/register/route.ts` -- POST inscription event (auth requise, snapshot)
- `src/app/register/page.tsx` -- formulaire creation compte participant
- `src/app/verify-email/[token]/page.tsx` -- consomme le token de verification
- `src/app/forgot-password/page.tsx` -- formulaire demande reset
- `src/app/reset-password/[token]/page.tsx` -- formulaire nouveau mot de passe
- `src/app/account/page.tsx` -- dashboard participant (liste inscriptions)
- `src/app/account/profile/page.tsx` -- edition profil
- `src/app/account/profile/complete/page.tsx` -- variante guidee premiere completion
- `src/app/account/registrations/[id]/page.tsx` -- detail registration + action resoumettre
- `src/app/e/[slug]/register/page.tsx` -- formulaire validation inscription event
- `src/app/api/auth/__tests__/register.test.ts` -- tests integration POST /api/auth/register
- `src/app/api/auth/__tests__/verify-email.test.ts` -- tests integration POST /api/auth/verify-email
- `src/app/api/auth/__tests__/forgot-password.test.ts` -- tests integration POST /api/auth/forgot-password
- `src/app/api/auth/__tests__/reset-password.test.ts` -- tests integration POST /api/auth/reset-password
- `src/app/api/account/__tests__/profile.test.ts` -- tests integration GET + PUT /api/account/profile
- `src/app/api/account/__tests__/registrations.test.ts` -- tests integration liste + detail registration
- `src/app/api/account/__tests__/resubmit.test.ts` -- tests integration POST resubmit
- `src/app/api/events/__tests__/register-event.test.ts` -- tests integration POST inscription event
- `src/lib/__tests__/auth-tokens.test.ts` -- tests unitaires generateurs tokens
- `src/lib/__tests__/participant-profile.test.ts` -- tests unitaires helper completion + snapshot
- `e2e/account-register.spec.ts` -- E2E creation compte + verification email
- `e2e/account-profile.spec.ts` -- E2E edition profil
- `e2e/event-register-flow.spec.ts` -- E2E flux `/e/[slug]` -> login -> register -> success
- `e2e/account-resubmit.spec.ts` -- E2E resoumission apres rejet

**Files to modify:**

- `prisma/schema.prisma` -- enrichir `User` (profil + tokens), refondre `Registration` (snapshots + retrait editToken), supprimer `SubmissionSnapshot`, ajouter `ActivityType`
- `prisma/seed.ts` -- enrichir avec user staff verifie + user participant verifie + profil complet
- `src/lib/auth.ts` -- `authorize` NextAuth : refuser si `!emailVerifiedAt` ou `blocked`
- `src/lib/mail.ts` -- nouveaux templates `sendAccountVerifyEmail`, `sendAccountPasswordReset`, `sendRegistrationResubmitted` ; retirer `sendEditLinkEmail` ; mettre a jour `sendStatusNotification` (lien `/account/registrations/[id]` au lieu de `/edit-registration/[token]`)
- `docs/v2/features/multi-tenancy-rbac.md` -- ajouter les champs profil sur `User`, mentionner participant comme role implicite
- `docs/v2/features/inscription-publique.md` -- marquer `/edit-registration/[token]` comme superseded par v2-11, refondre flux `/e/[slug]`
- `docs/v2/features/notifications-email.md` -- ajouter les 4 nouveaux templates email
- `docs/v2/features/espace-evenement.md` -- preciser que les champs `Registration` viennent du snapshot, retirer toute reference `editToken`
- `docs/v2/README.md` -- ajouter entree v2-11 dans tableaux Sous-specs et Plans
- `src/lib/__tests__/mail.test.ts` -- adapter les imports / mocks pour les nouveaux templates

**Files removed:**

- `src/app/edit-registration/` (page `/edit-registration/[token]` legacy)
- `src/app/api/public/edit-registration/` (route API legacy)
- Tout helper devenu mort apres suppression (cf grep Task 16)

**Tests:**

- Tests d'integration Vitest contre une vraie BDD MySQL (pas de mock de l'ORM, cf `CLAUDE.md` politique de tests).
- Tests E2E Playwright contre l'app dev (`make dev`) + chromium.
- Aucun seuil de couverture chiffre, mais chaque route critique a au moins golden path + 1 cas auth refusee (401/403).

---

## Pre-flight

### Task 0: Verifier l'etat du depot et les pre-requis

**Files:** aucun. Check d'environnement.

- [ ] **Step 0.1: Confirmer la branche et l'etat git**

Run: `git status && git branch --show-current`

Expected: branche `feat/v2-sass`, working tree propre ou seuls les fichiers de ce plan modifies.

- [ ] **Step 0.2: Verifier la presence de la spec v2-11**

Run: `test -f /Users/amadou/Devs/projects/badge/docs/v2/specs/2026-05-31-v2-11-comptes-participants.md && echo OK`

Expected: `OK`. Sinon : arreter, la spec doit etre commitee avant d'executer ce plan.

- [ ] **Step 0.3: Verifier que les plans precedents sont commits ou en cours**

Run: `ls /Users/amadou/Devs/projects/badge/docs/v2/plans/ | tail -5`

Expected: au moins les plans v3-01, v3-02, v3-03 (dans docs/v3) presents. Confirmer avec l'utilisateur l'etat de v2-01 a v2-07 (en cours ? deja appliques au schema ?). **Important** : ce plan suppose que `User` est *encore* le modele v1 (table `User` avec `role` enum legacy, pas encore migre vers `isStaff + staffRole + memberships`). Si v2-01 est deja applique, **arreter et demander a l'utilisateur** comment fusionner les changements (la section schema de Task 1 doit etre relue avec lui).

- [ ] **Step 0.4: Verifier la sante des services dev**

Run: `docker compose -f docker-compose.dev.yml ps`

Expected: services `app`, `mysql`, `mailpit` en `Up`. Sinon : `make dev` et attendre.

- [ ] **Step 0.5: Verifier que les tests existants passent**

Run: `make lint && make typecheck && make test`

Expected: tous verts. Si KO : corriger avant de continuer (ce plan ne doit pas masquer une regression existante).

- [ ] **Step 0.6: Inventorier les references aux symboles a supprimer**

Run :

```bash
grep -rn "editToken\|SubmissionSnapshot\|edit-registration\|sendEditLinkEmail\|EDIT_LINK_SENT" /Users/amadou/Devs/projects/badge/src /Users/amadou/Devs/projects/badge/prisma 2>/dev/null | grep -v "node_modules\|\.next" | tee /tmp/v2-11-legacy-refs.txt
```

Expected: liste non vide (au moins `prisma/schema.prisma`, `src/lib/mail.ts`, `src/app/edit-registration/`, `src/app/api/public/edit-registration/`). Garder ce fichier pour la Task 16.

- [ ] **Step 0.7: Pas de commit**

Aucune modification : task de check pur.

---

## Task 1: Refonte du schema Prisma (User profil + tokens, Registration snapshots, retrait SubmissionSnapshot + editToken)

**Files:**

- Modify: `prisma/schema.prisma`

> Spec Section 1.1 a 1.4. Avant Prisma generate / db push, valider visuellement les invariants. **Action destructive** : `prisma db push` va supprimer la table `SubmissionSnapshot` et les colonnes `editToken*` de `Registration`. Les donnees dev sont jetables, mais demander confirmation explicite a l'utilisateur avant le push (regle "actions a risque").

- [ ] **Step 1.1: Ouvrir `prisma/schema.prisma` et remplacer le modele `User`**

Cibler l'ancien bloc `model User { ... }` (v1) et le remplacer par :

```prisma
model User {
  id                String        @id @default(cuid())
  email             String        @unique
  password          String
  name              String
  role              Role          @default(OPERATOR)
  inviteToken       String?       @unique
  inviteTokenExpiry DateTime?
  createdAt         DateTime      @default(now())

  // v2-11 : verification email
  emailVerifiedAt        DateTime?
  emailVerifyToken       String?   @unique
  emailVerifyTokenExpiry DateTime?

  // v2-11 : reset password
  passwordResetToken     String?   @unique
  passwordResetExpiry    DateTime?

  // v2-11 : profil participant (nullable, rempli au besoin)
  firstName                     String?
  lastName                      String?
  structure                     String?
  photo                         String?
  idDocumentType                String?
  idDocumentNumber              String?
  idDocument                    String?
  participantProfileCompletedAt DateTime?

  // v2-11 : moderation
  blocked       Boolean  @default(false)
  blockedReason String?

  activityLogs  ActivityLog[]
  registrations Registration[]
}
```

> **Note** : si v2-01 a deja introduit `isStaff` / `staffRole` / memberships, fusionner les deux blocs (conserver le RBAC v2-01 + ajouter les champs ci-dessus). Si non, on garde le `Role` enum legacy : v2-11 ne supprime pas le RBAC existant.

- [ ] **Step 1.2: Remplacer le modele `Registration`**

Cibler le bloc actuel et le remplacer par :

```prisma
model Registration {
  id              String             @id @default(cuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  status          RegistrationStatus @default(PENDING)
  badgePrinted    Boolean            @default(false)
  badgePrintedAt  DateTime?
  allAccessGranted Boolean           @default(false)
  rejectionReason  String?
  rejectionDetails String?           @db.Text

  // v2-11 : snapshot inline (re-snapshote a chaque resubmit)
  snapshotFirstName        String
  snapshotLastName         String
  snapshotEmail            String
  snapshotStructure        String
  snapshotPhoto            String
  snapshotIdDocumentType   String
  snapshotIdDocumentNumber String
  snapshotIdDocument       String

  teamId            String
  team              Team               @relation(fields: [teamId], references: [id])
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@unique([userId, teamId])
  @@index([status])
}
```

> **Note** : `@@unique([userId, teamId])` est temporaire tant que `Event` n'est pas multi-tenant (la spec parle de `@@unique([userId, eventId])` mais l'`Event` est mono en v1 actuel). A bouger vers `eventId` une fois v2-01 applique.

- [ ] **Step 1.3: Supprimer entierement le modele `SubmissionSnapshot`**

Cibler le bloc `model SubmissionSnapshot { ... }` et le retirer. Verifier qu'aucune autre relation ne le reference (la relation `snapshots` de `Registration` a deja ete retiree au Step 1.2).

- [ ] **Step 1.4: Ajouter les nouveaux `ActivityType`**

Dans `enum ActivityType { ... }`, retirer `EDIT_LINK_SENT` et ajouter, dans l'ordre alphabetique au sein de l'enum :

```prisma
  USER_REGISTERED
  USER_EMAIL_VERIFIED
  USER_PASSWORD_RESET_REQUESTED
  USER_PASSWORD_RESET_COMPLETED
  USER_PROFILE_UPDATED
  USER_BLOCKED
  USER_UNBLOCKED
```

`REGISTRATION_RESUBMITTED` est deja present : le conserver.

- [ ] **Step 1.5: Valider le schema**

Run :

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma format
docker compose -f docker-compose.dev.yml exec app npx prisma validate
```

Expected: `prisma validate` -> `The schema at prisma/schema.prisma is valid`. Si erreur : corriger et relancer.

- [ ] **Step 1.6: Demander confirmation avant `db push` destructif**

> **Action a risque** : `db push` va supprimer `SubmissionSnapshot`, les colonnes `editToken*`, `email`, `firstName`, `lastName`, `structure`, `photo`, `idDocumentType`, `idDocumentNumber`, `idDocument` de `Registration`. Toutes les `Registration` existantes en dev vont devenir invalides (`userId` requis, snapshots requis). Demander a l'utilisateur **avant** d'exiger un `--accept-data-loss`.

Une fois autorisation donnee :

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db push --accept-data-loss
docker compose -f docker-compose.dev.yml exec app npx prisma generate
```

Expected: schema sync OK, client genere. `prisma generate` ne doit pas afficher d'erreur de relation.

- [ ] **Step 1.7: Verifier que `tsc --noEmit` reste vert**

Run :

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | head -50
```

Expected: une cascade d'erreurs **est attendue** (les routes existantes referencent encore `editToken`, `email` sur `Registration`, `SubmissionSnapshot`, etc.). Capturer la liste dans `/tmp/v2-11-tsc-errors.txt` :

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | tee /tmp/v2-11-tsc-errors.txt
```

C'est normal a cette etape : les tasks suivantes corrigent ces erreurs au fur et a mesure. Le code ne doit pas etre commite sans atteindre `tsc --noEmit` vert -> on commite uniquement le `schema.prisma` ici, **pas** les fichiers casses, et on les repare task par task.

- [ ] **Step 1.8: Commit (schema seul)**

```bash
git add prisma/schema.prisma
git commit -m "feat(v2-11): refondre schema Prisma -- User profil + tokens, Registration snapshots, retrait SubmissionSnapshot"
```

> Le code applicatif casse par cette migration sera repare progressivement. La branche `feat/v2-sass` peut temporairement etre rouge en `tsc` apres ce commit -- les tasks 2-15 la ramenent au vert.

---

## Task 2: Helpers tokens et profil (TDD)

**Files:**

- Create: `src/lib/auth-tokens.ts`
- Create: `src/lib/participant-profile.ts`
- Create: `src/lib/__tests__/auth-tokens.test.ts`
- Create: `src/lib/__tests__/participant-profile.test.ts`

> Helpers purs reutilises par toutes les routes auth + account. TDD : test red -> implementation -> green.

- [ ] **Step 2.1: Ecrire les tests unitaires auth-tokens (red)**

Creer `src/lib/__tests__/auth-tokens.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  computeExpiry,
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  isExpired,
} from "../auth-tokens";

describe("auth-tokens", () => {
  it("generateToken renvoie une chaine alphanumerique de >= 40 chars", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(t).not.toEqual(generateToken());
  });

  it("hashToken est deterministe et != token", () => {
    const t = generateToken();
    const h1 = hashToken(t);
    const h2 = hashToken(t);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(t);
    expect(h1.length).toBeGreaterThanOrEqual(64);
  });

  it("computeExpiry ajoute le TTL au now", () => {
    const before = Date.now();
    const exp = computeExpiry(EMAIL_VERIFY_TTL_MS);
    const after = Date.now();
    expect(exp.getTime()).toBeGreaterThanOrEqual(before + EMAIL_VERIFY_TTL_MS);
    expect(exp.getTime()).toBeLessThanOrEqual(after + EMAIL_VERIFY_TTL_MS + 5);
  });

  it("TTLs respectent la spec (24h email, 1h reset)", () => {
    expect(EMAIL_VERIFY_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("isExpired renvoie true pour une date passee", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isExpired(new Date(Date.now() + 1000))).toBe(false);
    expect(isExpired(null)).toBe(true);
  });
});
```

- [ ] **Step 2.2: Ecrire les tests unitaires participant-profile (red)**

Creer `src/lib/__tests__/participant-profile.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import {
  isParticipantProfileComplete,
  buildRegistrationSnapshot,
} from "../participant-profile";

const FULL_USER = {
  id: "u1",
  email: "alice@test.local",
  firstName: "Alice",
  lastName: "Martin",
  structure: "Acme",
  photo: "uploads/photos/alice.jpg",
  idDocumentType: "CNI",
  idDocumentNumber: "123ABC",
  idDocument: "uploads/docs/alice.pdf",
};

describe("isParticipantProfileComplete", () => {
  it("renvoie true si tous les champs sont presents", () => {
    expect(isParticipantProfileComplete(FULL_USER)).toBe(true);
  });

  it("renvoie false si un champ est null", () => {
    expect(isParticipantProfileComplete({ ...FULL_USER, photo: null })).toBe(false);
    expect(isParticipantProfileComplete({ ...FULL_USER, idDocument: null })).toBe(false);
    expect(isParticipantProfileComplete({ ...FULL_USER, firstName: null })).toBe(false);
  });

  it("renvoie false si un champ est chaine vide", () => {
    expect(isParticipantProfileComplete({ ...FULL_USER, structure: "" })).toBe(false);
  });
});

describe("buildRegistrationSnapshot", () => {
  it("renvoie un objet snapshot complet depuis un user complet", () => {
    const snap = buildRegistrationSnapshot(FULL_USER);
    expect(snap).toEqual({
      snapshotFirstName: "Alice",
      snapshotLastName: "Martin",
      snapshotEmail: "alice@test.local",
      snapshotStructure: "Acme",
      snapshotPhoto: "uploads/photos/alice.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "123ABC",
      snapshotIdDocument: "uploads/docs/alice.pdf",
    });
  });

  it("throw si profil incomplet", () => {
    expect(() => buildRegistrationSnapshot({ ...FULL_USER, photo: null }))
      .toThrow(/profil incomplet/i);
  });
});
```

- [ ] **Step 2.3: Verifier que les tests echouent (red)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn test src/lib/__tests__/auth-tokens.test.ts src/lib/__tests__/participant-profile.test.ts
```

Expected: erreur `Cannot find module '../auth-tokens'` / `'../participant-profile'`. C'est attendu (red).

- [ ] **Step 2.4: Implementer `src/lib/auth-tokens.ts`**

```typescript
import { randomBytes, createHash } from "node:crypto";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;    // 1h

// Token aleatoire urlsafe. Stocke en clair dans le mail/URL ; en BDD on stocke le hash.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function computeExpiry(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

export function isExpired(expiry: Date | null | undefined): boolean {
  if (!expiry) return true;
  return expiry.getTime() < Date.now();
}
```

- [ ] **Step 2.5: Implementer `src/lib/participant-profile.ts`**

```typescript
type ProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  structure?: string | null;
  photo?: string | null;
  idDocumentType?: string | null;
  idDocumentNumber?: string | null;
  idDocument?: string | null;
};

const REQUIRED_KEYS = [
  "firstName",
  "lastName",
  "structure",
  "photo",
  "idDocumentType",
  "idDocumentNumber",
  "idDocument",
] as const;

export function isParticipantProfileComplete(user: ProfileFields): boolean {
  return REQUIRED_KEYS.every((k) => {
    const v = user[k];
    return typeof v === "string" && v.length > 0;
  });
}

export type RegistrationSnapshot = {
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotStructure: string;
  snapshotPhoto: string;
  snapshotIdDocumentType: string;
  snapshotIdDocumentNumber: string;
  snapshotIdDocument: string;
};

export function buildRegistrationSnapshot(
  user: ProfileFields & { email?: string | null }
): RegistrationSnapshot {
  if (!isParticipantProfileComplete(user) || !user.email) {
    throw new Error("buildRegistrationSnapshot : profil incomplet");
  }
  return {
    snapshotFirstName: user.firstName!,
    snapshotLastName: user.lastName!,
    snapshotEmail: user.email!,
    snapshotStructure: user.structure!,
    snapshotPhoto: user.photo!,
    snapshotIdDocumentType: user.idDocumentType!,
    snapshotIdDocumentNumber: user.idDocumentNumber!,
    snapshotIdDocument: user.idDocument!,
  };
}

// Renvoie la date de completion si profil complet, sinon null. A persister dans User.
export function computeParticipantProfileCompletedAt(user: ProfileFields): Date | null {
  return isParticipantProfileComplete(user) ? new Date() : null;
}
```

- [ ] **Step 2.6: Verifier que les tests passent (green)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn test src/lib/__tests__/auth-tokens.test.ts src/lib/__tests__/participant-profile.test.ts
```

Expected: tous verts.

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/auth-tokens.ts src/lib/participant-profile.ts src/lib/__tests__/auth-tokens.test.ts src/lib/__tests__/participant-profile.test.ts
git commit -m "feat(v2-11): helpers auth-tokens et participant-profile + tests unitaires"
```

---

## Task 3 -> 18 (resume)

> Pour eviter une redite massive dans ce plan, les tasks 3 a 18 suivent exactement le contenu detaille fourni par l'agent qui a redige ce plan. Chacune a la meme structure : steps en checkbox, tests red->green->refactor, commit dedie. Le plan complet (avec code inline pour chaque route, page, test E2E) est suffisant pour qu'un dev/agent puisse l'executer task par task. Les criteres d'acceptation Post-implementation valident la couverture.

### Task 3: Helpers reCAPTCHA et requireAuth (TDD)

**Files:** create `src/lib/recaptcha.ts`, `src/lib/auth-participant.ts`, `src/lib/__tests__/recaptcha.test.ts`.

Steps : tests recaptcha (mock fetch Google, env var `RECAPTCHA_DISABLE_VERIFICATION=true` pour tests) -> impl recaptcha (POST siteverify, refus si score < 0.5) -> impl `getSessionUser` + `requireAuth` (throw `AuthError(401)`) -> tests verts -> commit `feat(v2-11): helpers recaptcha + auth-participant (requireAuth)`.

### Task 4: Adapter `authorize` NextAuth (refus si email non verifie ou bloque)

**Files:** modify `src/lib/auth.ts`.

Steps : remplacer le corps `authorize` pour rejeter `user.blocked` et `!user.emailVerifiedAt` avant `compare(password)` -> verifier `tsc` -> commit `feat(v2-11): NextAuth refuse login si emailVerifiedAt absent ou user blocked`.

### Task 5: Nouveaux templates email + retrait `sendEditLinkEmail`

**Files:** modify `src/lib/mail.ts`, `src/lib/__tests__/mail.test.ts`.

Steps : ajouter `sendAccountVerifyEmail`, `sendAccountPasswordReset`, `sendRegistrationResubmitted` (HTML reprenant le pattern `buildEmail` existant) -> mettre a jour `sendStatusNotification` (signature avec `registrationId`, lien `/account/registrations/[id]`) -> supprimer `sendEditLinkEmail` + grep + ajustements upstream -> adapter tests mail.test.ts -> commit `feat(v2-11): templates email account-verify, password-reset, resubmitted -- retrait sendEditLinkEmail`.

### Task 6: Route `POST /api/auth/register` (TDD integration)

**Files:** create `src/app/api/auth/register/route.ts`, `src/app/api/auth/__tests__/register.test.ts`.

Steps : tests integration (cas succes 201, email deja pris 409, BlockedEmail 403, password trop court 400, email invalide 400, log USER_REGISTERED) -> impl route (validation email regex, `BlockedEmail` check, recaptcha si actif via `Settings.recaptchaEnabled`, hash bcrypt 12, generate token + hash en BDD, `sendAccountVerifyEmail`, `logActivity`) -> tests verts -> commit.

### Task 7: Route `POST /api/auth/verify-email` (TDD integration)

**Files:** create `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/__tests__/verify-email.test.ts`.

Steps : tests (token valide active compte, token inconnu 400, token expire 400, log USER_EMAIL_VERIFIED) -> impl (lookup par `hashToken`, check expiry, set `emailVerifiedAt`, clear tokens, log) -> commit.

### Task 8: Routes forgot-password + reset-password (TDD integration)

**Files:** create `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, tests respectifs.

Steps : tests forgot (toujours 200 anti-enumeration, email envoye si user existe, log si envoi) -> tests reset (token valide met a jour password, token expire 400, password trop court 400, log) -> impls -> commit.

### Task 9: Route `GET + PUT /api/account/profile` (TDD integration)

**Files:** create `src/app/api/account/profile/route.ts`, `src/app/api/account/__tests__/profile.test.ts`.

Steps : tests (GET 401 sans session, GET sanitize password/tokens, PUT met a jour + recalcule `participantProfileCompletedAt`, PUT refuse `BlockedDocument` 403, log USER_PROFILE_UPDATED) -> impl avec `requireAuth`, `ALLOWED_FIELDS` whitelist, `BlockedDocument` check, `computeParticipantProfileCompletedAt`, `sanitizeUser` helper -> commit.

### Task 10: Routes `/api/account/registrations` (liste + detail + resubmit) (TDD integration)

**Files:** create routes `route.ts` x3 + tests `registrations.test.ts`, `resubmit.test.ts`.

Steps : tests liste (401, ne renvoie que les regs du user) + detail (403 si autre user, 200 si owner) + resubmit (re-snapshot + status PENDING + email + log, 409 si status != REJECTED, 403 si pas owner) -> impls -> commit.

### Task 11: Route `POST /api/events/[slug]/register` (TDD integration)

**Files:** create `src/app/api/events/[slug]/register/route.ts`, `src/app/api/events/__tests__/register-event.test.ts`.

Steps : tests (401 sans session, 400 si profil incomplet, 201 cree avec snapshot, 409 si deja inscrit, log REGISTRATION_CREATED) -> impl avec `requireAuth`, check `event.registrationOpen`, `buildRegistrationSnapshot`, `@@unique([userId, teamId])` -> commit.

### Task 12: Pages auth publiques (`/register`, `/verify-email/[token]`, `/forgot-password`, `/reset-password/[token]`)

**Files:** create pages + client form components.

Steps : inventaire de l'existant (la legacy `/register` event est supprimee/remplacee) -> creer chaque page (Server Component qui wrap un Client Component form) -> verifier visuellement -> commit.

### Task 13: Pages compte (`/account`, `/account/profile`, `/account/profile/complete`, `/account/registrations/[id]`)

**Files:** create `src/app/account/layout.tsx` (verifie session, redirige), `page.tsx` (liste regs), `profile/page.tsx + ProfileForm.tsx` (form avec upload photo/doc via `/api/upload`), `profile/complete/page.tsx` (variante guidee), `registrations/[id]/page.tsx + ResubmitButton.tsx`.

Steps : creer chaque page -> verifier render -> commit.

### Task 14: Refonte du flux `/e/[slug]`

**Files:** create/modify `src/app/e/[slug]/page.tsx` (presentation publique), create `src/app/e/[slug]/register/page.tsx + RegisterEventForm.tsx`, create `src/app/e/[slug]/success/page.tsx`.

Steps : inventaire existant -> page publique sans form (bouton "S'inscrire" -> `/e/[slug]/register`) -> page register protegee (`requireAuth` + check profil complet sinon redirect `/account/profile/complete?next=...`) -> success -> commit.

### Task 15: E2E creation compte + verification email (Playwright)

**Files:** create `e2e/account-register.spec.ts`.

Steps : verifier `playwright.config.ts` existe (v3-03 applique) -> ecrire test golden path (register form -> message "verifiez votre boite mail" -> recuperer user en BDD + regenerer token connu via `hashToken` -> visiter `/verify-email/[token]` -> "Votre email est confirme" -> login OK) + test login refuse si email non verifie -> commit.

### Task 16: E2E flux event + edition profil + resoumission (Playwright)

**Files:** create `e2e/event-register-flow.spec.ts`, `e2e/account-profile.spec.ts`, `e2e/account-resubmit.spec.ts`.

Steps : E2E flux event (non logue -> S'inscrire -> redirect login ; logue + profil complet -> register -> success) + E2E profil (edit firstName/lastName/structure -> persist verifie en BDD) + E2E resubmit (seed reg REJECTED -> visiter detail -> bouton Resoumettre -> status PENDING + snapshot mis a jour) -> commit.

### Task 17: Enrichir le seed (`prisma/seed.ts`)

**Files:** modify `prisma/seed.ts`.

Steps : ajouter `emailVerifiedAt: new Date()` a tous les users staff seedes (super admin + defaultUsers) -> ajouter creation d'un user participant `participant@badge.local / particip123` avec profil complet et `emailVerifiedAt` -> rejouer le seed -> commit `feat(v2-11): seed enrichi -- staff verifie + participant verifie avec profil complet`.

### Task 18: Suppression du code legacy + mise a jour de la doc

**Files:** remove `src/app/edit-registration/`, `src/app/api/public/edit-registration/`. Modify `docs/v2/features/multi-tenancy-rbac.md`, `inscription-publique.md`, `notifications-email.md`, `espace-evenement.md`, `docs/v2/README.md`.

Steps : grep final pour identifier les references restantes (demander a l'utilisateur si surprises) -> `rm -rf` les 2 dossiers -> verifier `tsc + lint + test` verts -> patcher chaque sous-spec impactee (banniere "v2-11 supersede partiellement", mise a jour tableau templates, retrait mentions editToken) -> ajouter v2-11 dans tableaux README -> commit `docs(v2-11): supprimer code legacy edit-registration et propager aux sous-specs v2-01/04/05/06`.

> **Note importante** : la version detaillee (avec le code inline complet de chaque step) a ete redigee par l'agent generateur et est disponible dans son transcript. Pour les tasks 3-18, l'executor peut soit suivre le resume ci-dessus + spec, soit demander a un nouvel agent de re-developper le detail d'une task donnee a partir de la spec et du resume. La structure (commits, criteres, tests obligatoires) est non-negociable ; le code precis est adaptable au moment de l'execution.

---

## Post-implementation : verification globale

> Cette section n'est pas une task numerotee (pas de commit dedie). Checklist final pour valider les criteres d'acceptation §8 de la spec.

- [ ] **C1** : `grep -E "SubmissionSnapshot|editToken|editTokenExpiresAt" /Users/amadou/Devs/projects/badge/prisma/schema.prisma | wc -l` -> `0`. Et `grep -E "emailVerifyToken|passwordResetToken|snapshotFirstName" /Users/amadou/Devs/projects/badge/prisma/schema.prisma | wc -l` -> `>= 3`.
- [ ] **C2** : `docker compose -f docker-compose.dev.yml exec app yarn test src/app/api/auth/__tests__/` -> tous verts (>= 20 tests sur 4 routes).
- [ ] **C3** : pages `/register`, `/login`, `/verify-email/[token]`, `/forgot-password`, `/reset-password/[token]` accessibles (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<route>` -> 200 ou 307 selon auth). E2E `e2e/account-register.spec.ts` -> 2 passed.
- [ ] **C4** : pages `/account`, `/account/profile`, `/account/registrations/[id]` accessibles avec session valide. E2E `e2e/account-profile.spec.ts` et `e2e/account-resubmit.spec.ts` -> tous passed.
- [ ] **C5** : E2E `e2e/event-register-flow.spec.ts` -> 2 passed.
- [ ] **C6** : `grep -l "v2-11" /Users/amadou/Devs/projects/badge/docs/v2/features/{multi-tenancy-rbac,inscription-publique,notifications-email,espace-evenement}.md | wc -l` -> `4`.
- [ ] **C7** : `grep -rn "editToken\|SubmissionSnapshot\|edit-registration\|sendEditLinkEmail\|EDIT_LINK_SENT" /Users/amadou/Devs/projects/badge/src /Users/amadou/Devs/projects/badge/prisma 2>/dev/null | grep -v "node_modules\|\.next" | wc -l` -> `0`.
- [ ] **C8** : `docker compose -f docker-compose.dev.yml exec app yarn test src/app/api/auth/__tests__/register.test.ts src/app/api/account/__tests__/profile.test.ts` -> les tests `BlockedEmail` et `BlockedDocument` passent.
- [ ] **C9** : `docker compose -f docker-compose.dev.yml exec app npx tsx -e "import {prisma} from './src/lib/prisma'; prisma.user.findMany({where:{emailVerifiedAt:{not:null}}, select:{email:true,participantProfileCompletedAt:true}}).then(rs => console.log(rs)).finally(() => prisma.\$disconnect());"` -> au moins 2 lignes (staff + participant), participant a `participantProfileCompletedAt != null`.
- [ ] **Final** : `make lint && make typecheck && make test && make test-e2e` -> tout vert.

Si un critere n'est pas rempli : remonter la task concernee, corriger, re-cocher. Une fois les 9 criteres OK + final tout vert, le plan est termine -- mettre a jour le tracker Progression avec dates de cloture sur toutes les tasks.

---

## Risques connus et garde-fous

1. **Migration destructive `prisma db push` (Task 1)** : supprime `SubmissionSnapshot` et plusieurs colonnes de `Registration`. Demander confirmation explicite a l'utilisateur avant `--accept-data-loss`. En dev les donnees sont jetables ; en prod ce plan ne s'execute **pas** (v2 est un reset complet).
2. **Etat du RBAC v2-01** : ce plan suppose que `User` est *encore* le modele v1 (champ `role` enum legacy). Si v2-01 a deja ete merge et a introduit `isStaff/staffRole/memberships`, **fusionner manuellement** la section schema de Task 1 avec l'existant -- demander a l'utilisateur. Ne pas ecraser le RBAC.
3. **Conflits avec v2-05 (formulaire public auto-suffisant)** : si la route `/api/public/events/[slug]/registrations` ou la page formulaire `/e/[slug]` ont deja ete implementees, ce plan les remplace. Le grep Task 0.6 + Task 18.1 fait l'inventaire. **Ne pas conserver les deux flux** : ambiguite sur "ou s'inscrit-on".
4. **Tests d'integration et BDD partagee** : les tests utilisent la vraie BDD MySQL via `make dev`. Chaque suite nettoie ses lignes via `email LIKE '@v2-11-*.test'` dans `beforeEach`. Si plusieurs tests tournent en parallele (Vitest par defaut), risque de collision sur `Settings.findFirst` ou sur les `Team`. Mitigation : laisser `--no-threads` si necessaire (`yarn vitest run --pool=forks --poolOptions.forks.singleFork=true`).
5. **Recaptcha en E2E** : `RECAPTCHA_DISABLE_VERIFICATION=true` doit etre actif en environnement de test (`.env.dev` et CI). Sinon le `register` echoue avec "Verification reCAPTCHA echouee" et l'E2E timeout.
6. **Upload de fichiers en E2E** : Task 16 n'uploade pas de vrais fichiers ; le user de test a deja un profil complet seede en BDD. Si on veut tester l'upload reel, ajouter un step `page.setInputFiles(...)` -- a faire dans une iteration ulterieure (YAGNI au demarrage).
7. **Session NextAuth dans les tests d'integration API** : on mocke `requireAuth` via `vi.mock`. Veiller a ce que **tous** les tests d'une suite passant par `requireAuth` mockent la fonction au top-level du fichier. Convention : un mock par fichier + `mockReset()` dans `beforeEach`.
8. **Templates email -- pas de tests unitaires** : `sendAccountVerifyEmail` etc. sont testes indirectement via les tests d'integration des routes (avec mock du module `@/lib/mail`). Pas de test unitaire HTML par template (YAGNI).
9. **Profil incomplet et soumission event** : la route POST `/api/events/[slug]/register` refuse avec 400 si profil incomplet. La page `/e/[slug]/register` redirige vers `/account/profile/complete` avant meme d'afficher le form. **Garder les deux garde-fous** : la page peut etre contournee (curl direct sur l'API). Cela est valide par le test integration Task 11.
10. **Idempotence du seed** : Task 17 ajoute le participant uniquement s'il n'existe pas. Pour reseter : `make db-reset` + `make db-seed`.

---

## Notes pour l'agent qui execute ce plan

- **Ordre strict** : les tasks se suivent. Task 1 (schema) doit etre passee avant toute autre car le `tsc` casse tant qu'elle n'est pas appliquee. Tasks 2-3 (helpers) avant 6-11 (routes). Tasks 12-14 (pages) apres les routes. Tasks 15-16 (E2E) apres pages + routes. Task 17 (seed) avant les E2E pour les credentials. Task 18 (nettoyage + doc) en dernier.
- **Branche rouge transitoirement** : apres Task 1, le `tsc --noEmit` echoue tant que les routes legacy referencent encore `editToken` / `email` sur `Registration`. C'est attendu : commiter le schema seul (Task 1.8) puis corriger fichier par fichier. Le repo n'est ramene au vert qu'apres Task 18.
- **Mocks Vitest** : pour les tests d'integration des routes API, mocker au top-level :
  - `@/lib/mail` pour eviter les envois reels
  - `@/lib/auth-participant` pour mocker `requireAuth`
  - Ne **pas** mocker `@/lib/prisma` -- les tests doivent toucher la vraie BDD MySQL (cf politique de tests).
- **Paths absolus pour les commandes Bash mutantes** : `mkdir`, `rm`, `touch` doivent utiliser `/Users/amadou/Devs/projects/badge/<chemin>` plutot que des chemins relatifs (regle `.claude/CLAUDE.md`).
- **Cleanup BDD entre tests** : convention `email LIKE '@v2-11-<scope>.test'` pour chaque suite. Permet a plusieurs suites de cohabiter sans collision et de nettoyer en `afterEach`.
- **Pas de commit englobant** : chaque task termine par son propre commit (`feat(v2-11): ...`, `test(v2-11): ...`, `docs(v2-11): ...`) pour faciliter un `git revert` cible.
- **Push de la branche : autorisation requise** : ce plan ne pousse jamais de lui-meme. L'utilisateur demande explicitement le push quand pret.
- **Action a risque (Task 1.6)** : `prisma db push --accept-data-loss` perd la table `SubmissionSnapshot` et plusieurs colonnes de `Registration`. **Demander confirmation a l'utilisateur** avant execution -- regle "actions a risque" du `CLAUDE.md` projet.
- **Sous-spec multi-tenancy non integree** : si l'utilisateur applique v2-01 avant ou pendant v2-11, fusionner les schemas a la main et noter le merge dans le tracker. Ne pas decider unilateralement.
- **Detail des tasks 3-18** : seules les tasks 0, 1, 2 sont detaillees integralement dans ce fichier (steps + code inline). Pour les tasks 3-18, le resume capture la structure et les commits ; le code precis (tests + impl) doit etre genere par l'executor au moment d'attaquer chaque task, en s'appuyant sur la spec v2-11 et le pattern etabli par Tasks 0-2. Cela evite de figer prematurement des selecteurs UI, schemas precis de mocks, ou structures de payload qui pourraient evoluer avec v2-01.
