# Validation des documents par le staff plateforme — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md`](../specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md)
**Depend de :** plan 06 (composant `DocumentPreview`, Task 2)

**Goal:** Faire valider la photo et la piece d'identite d'un participant par le staff plateforme, une fois pour toutes, avec historique complet des soumissions et catalogue de motifs de rejet ; interdire l'inscription a un evenement tant que le profil n'est pas approuve, l'organisation conservant son approbation metier par evenement.

**Architecture:** Une table `ProfileSubmission` immuable enregistre chaque envoi de pieces ; `User.profileStatus` est un miroir denormalise dont l'ecriture est confinee a un helper unique `src/lib/profile-review.ts`. Un catalogue `RejectionReason` administre dans les parametres plateforme alimente les rejets de profil **et** d'inscription, chaque motif portant sa portee. Le gate d'inscription et le gel de l'approbation cote organisation decoulent tous deux de `profileStatus` : aucun etat supplementaire n'est persiste.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma 6 / MySQL 8, Zod, NextAuth, nodemailer, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » ne valent pas autorisation.
2. **Aucune migration de donnees.** L'application n'est pas en production : `make db-push` + `make db-seed`. Ne jamais lancer `make db-reset` sans demander.
3. **`src/lib/profile-review.ts` est le seul module autorise a ecrire `User.profileStatus`.** Toute autre ecriture est un defaut a corriger.
4. **Les `ProfileSubmission` sont immuables** apres decision : on ne modifie jamais une soumission passee, on en cree une nouvelle.
5. **Seuils de couverture = gate a 100%** (lignes / branches / fonctions / statements) sur `src/lib/**` et `src/app/api/**`.
6. **Contrat minimal par route API** (politique de tests) : 1 golden path, 1 cas 401, 1 cas 403 par frontiere de role, 1 cas 400 de validation, 1 cas 404 le cas echeant, et l'assertion `logActivity` pour toute action sensible.
7. **Ne jamais exposer** dans une reponse API : hash bcrypt, `smtpPassword`, `recaptchaSecretKey`, tokens non hashes. Les cles de stockage des documents ne sont exposees qu'aux roles autorises a les lire.
8. **Contrat E2E strict :** zero `page.request.*`, connexion via `loginAndEnter`, URL assertee a chaque etape, succes **et** echec asseres.
9. **Langue :** UI, emails et documentation en francais accentue ; code et identifiants en anglais ASCII.
10. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, plus verification navigateur pour les changements UI.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schema Prisma (`ProfileSubmission`, `RejectionReason`, `ProfileStatus`, `ActivityType`) + seed | [x] | 2026-08-07 | Catalogue de motifs + profils PENDING/REJECTED/APPROVED seedes |
| 2 | `src/lib/profile-review.ts` — transitions et invariants | [ ] | | |
| 3 | API catalogue des motifs de rejet (plateforme) | [ ] | | |
| 4 | Soumission cote participant (creation a chaque changement de piece) | [ ] | | |
| 5 | API de moderation plateforme (liste, approbation, rejet) + emails | [ ] | | |
| 6 | Gate d'inscription + gel de l'approbation cote organisation | [ ] | | |
| 7 | UI plateforme (file d'attente, detail, onglet motifs) | [ ] | | |
| 8 | UI participant (statut, historique) et UI organisation (etat verifie, motif catalogue) | [ ] | | |
| 9 | Couverture E2E + documentation | [ ] | | |

---

## Etat initial (constate le 2026-08-07)

- `User` (schema l.36-52) porte le profil participant : `firstName`, `lastName`, `structure`, `photo`, `idDocumentType`, `idDocumentNumber`, `idDocument`, `participantProfileCompletedAt`. Pas de notion de validation.
- `Registration` (l.237-277) porte le snapshot inline, `status`, `rejectionReason` (String?), `rejectionDetails` (Text?). La resoumission **reecrit** le snapshot (commentaire l.258-260).
- `PUT /api/account/profile` (`src/app/api/account/profile/route.ts`) met a jour le profil et recalcule `participantProfileCompletedAt`.
- `POST /api/events/[slug]/register` construit le snapshot via `buildRegistrationSnapshot` et cree la registration en `PENDING`.
- `POST …/registrations/[regId]/approve` et `…/reject` sont gardes par `withEventAuth({ minRole: "OPERATOR" })` ; `reject` accepte `{ reason: string (1..200), details?: string }` en **saisie libre**.
- Les routes plateforme utilisent `withStaffAuth(handler, { minRole })` (`src/lib/with-staff-auth.ts`), qui delegue a `requireStaff` (`src/lib/auth-guards.ts`) et renvoie 401 sans session, sinon le code d'erreur de `AuthError`.
- Navigation staff : `src/components/staff/StaffShell.tsx`, tableau `NAV` l.5-12.
- Page des parametres plateforme : `src/app/platform/settings/page.tsx` (formulaire unique, pas encore d'onglets).
- Emails : `buildEmail({ title, body, ctx })` + `safeSend({ to, subject, html, ctx })` dans `src/lib/mail.ts`.
- `DocumentPreview` est fourni par le plan 06, Task 2 : `<DocumentPreview storageKey label readable? />`.

---

## Task 1 : Schema, enums et seed

**Files:**
- Modify: `prisma/schema.prisma` (models `User`, `Registration` ; nouveaux models et enums ; enum `ActivityType`)
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consomme : rien.
- Produit : `ProfileSubmission`, `RejectionReason`, enums `ProfileStatus`, `ProfileSubmissionStatus`, `RejectionScope`, champ `User.profileStatus`, champ `Registration.rejectionReasonId`, six nouveaux `ActivityType`. Consommes par toutes les tasks suivantes.

- [x] **Step 1 : Ajouter les models et enums**

Dans `prisma/schema.prisma`, apres le model `Registration` :

```prisma
// v4 (plan 08) : chaque envoi de pieces cree une ligne IMMUABLE. La derniere ligne
// fait foi ; `User.profileStatus` en est le miroir denormalise (cf. src/lib/profile-review.ts).
model ProfileSubmission {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  photo            String
  idDocumentType   String
  idDocumentNumber String
  idDocument       String

  status               ProfileSubmissionStatus @default(PENDING)
  rejectionReasonId    String?
  rejectionReason      RejectionReason?        @relation(fields: [rejectionReasonId], references: [id], onDelete: SetNull)
  // Libelle fige a la decision : renommer ou archiver un motif ne doit pas
  // reecrire l'historique.
  rejectionReasonLabel String?
  rejectionDetails     String?                 @db.Text

  reviewedById String?
  reviewedAt   DateTime?
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
  @@index([status])
}

enum ProfileSubmissionStatus {
  PENDING
  APPROVED
  REJECTED
}

// v4 (plan 08) : catalogue administre dans les parametres plateforme. La portee
// filtre les motifs proposes selon le contexte de rejet.
model RejectionReason {
  id         String         @id @default(cuid())
  label      String
  scope      RejectionScope
  sortOrder  Int            @default(0)
  archived   Boolean        @default(false)
  archivedAt DateTime?
  createdAt  DateTime       @default(now())

  profileSubmissions ProfileSubmission[]
  registrations      Registration[]

  @@index([archived, scope])
}

enum RejectionScope {
  PROFILE
  REGISTRATION
  BOTH
}

enum ProfileStatus {
  INCOMPLETE
  PENDING
  APPROVED
  REJECTED
}
```

Dans le model `User`, apres `participantProfileCompletedAt` :

```prisma
  // v4 (plan 08) : miroir de la derniere ProfileSubmission. Ecrit UNIQUEMENT par
  // src/lib/profile-review.ts.
  profileStatus ProfileStatus @default(INCOMPLETE)
```

et dans la liste des relations : `profileSubmissions ProfileSubmission[]`.

Dans le model `Registration`, a cote de `rejectionReason` :

```prisma
  // v4 (plan 08) : reference au catalogue ; `rejectionReason` conserve le libelle
  // fige au moment de la decision.
  rejectionReasonId String?
  rejectionReasonRef RejectionReason? @relation(fields: [rejectionReasonId], references: [id], onDelete: SetNull)
```

Dans l'enum `ActivityType`, a la fin :

```prisma
  // v4 (plan 08) : validation des profils par le staff plateforme
  PROFILE_SUBMITTED
  PROFILE_APPROVED
  PROFILE_REJECTED
  REJECTION_REASON_CREATED
  REJECTION_REASON_UPDATED
  REJECTION_REASON_ARCHIVED
```

- [x] **Step 2 : Pousser le schema**

Run : `make db-push`
Attendu : `The database is now in sync with your Prisma schema.` et regeneration du client.

- [x] **Step 3 : Verifier le typage**

Run : `make typecheck`
Attendu : PASS. Le client Prisma expose `prisma.profileSubmission` et `prisma.rejectionReason`.

- [x] **Step 4 : Seeder le catalogue de motifs**

Dans `prisma/seed.ts`, creer les motifs par defaut (idempotent : `upsert` sur le libelle, ou `createMany` precede d'un test d'existence, en suivant le style du fichier) :

| Libelle | Portee | Ordre |
|---|---|---|
| Photo illisible ou de mauvaise qualite | PROFILE | 10 |
| Photo non conforme (visage non visible) | PROFILE | 20 |
| Piece d'identite illisible | PROFILE | 30 |
| Piece d'identite expiree | PROFILE | 40 |
| Informations incoherentes entre la piece et le profil | PROFILE | 50 |
| Document suspecte de falsification | BOTH | 60 |
| Categorie demandee non justifiee | REGISTRATION | 70 |
| Quota de la categorie atteint | REGISTRATION | 80 |
| Inscription en doublon | REGISTRATION | 90 |

- [x] **Step 5 : Seeder des profils participants dans les trois etats**

Toujours dans `prisma/seed.ts` : creer au moins un participant `APPROVED` (avec sa `ProfileSubmission` approuvee), un `PENDING` et un `REJECTED` (avec motif et details), de sorte que les ecrans de la Task 7 aient de la matiere sans manipulation manuelle.

- [x] **Step 6 : Lancer le seed**

Run : `make db-seed`
Attendu : succes, sans erreur de contrainte.

- [x] **Step 7 : Verification**

Run : `make lint && make typecheck && make test`
Attendu : tout vert. Les tests existants ne connaissent pas encore `profileStatus` (defaut `INCOMPLETE`) : aucun ne doit echouer a ce stade puisque aucun gate n'est encore branche.

- [x] **Step 8 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add prisma/schema.prisma prisma/seed.ts
git commit -m "feat(v4): schema de validation des profils participants"
```

---

## Task 2 : `src/lib/profile-review.ts`

**Files:**
- Create: `src/lib/profile-review.ts`
- Create: `src/lib/__tests__/profile-review.test.ts`

**Interfaces:**
- Consomme : `prisma` (`src/lib/prisma.ts`), models de la Task 1.
- Produit :
  - `submitProfile(userId: string): Promise<ProfileSubmission | null>`
  - `approveProfile(args: { userId: string; reviewerId: string }): Promise<ProfileSubmission>`
  - `rejectProfile(args: { userId: string; reviewerId: string; reasonId: string; details?: string }): Promise<ProfileSubmission>`
  - `getCurrentSubmission(userId: string): Promise<ProfileSubmission | null>`
  - `class ProfileReviewError extends Error { code: "NO_PENDING_SUBMISSION" | "REASON_NOT_FOUND" | "REASON_WRONG_SCOPE"; httpStatus: number }`

  Consommes par les Tasks 4, 5 et 6.

- [ ] **Step 1 : Ecrire les tests en echec**

Creer `src/lib/__tests__/profile-review.test.ts`. Couvrir, avec de vraies ecritures Prisma (pas de mock) :

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  submitProfile,
  approveProfile,
  rejectProfile,
  getCurrentSubmission,
  ProfileReviewError,
} from "@/lib/profile-review";

const COMPLETE = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "ACME",
  photo: "profile/u1/photos/p.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "profile/u1/documents/d.pdf",
};

async function createUser(email: string, profile: Partial<typeof COMPLETE> = COMPLETE) {
  return prisma.user.create({
    data: { email, password: "x", name: "U", ...profile },
  });
}

async function createReason(scope: "PROFILE" | "REGISTRATION" | "BOTH", label = "Photo illisible") {
  return prisma.rejectionReason.create({ data: { label, scope } });
}

describe("submitProfile", () => {
  it("cree une soumission PENDING et bascule le profil en PENDING", async () => {
    const user = await createUser("submit@pr.test");
    const submission = await submitProfile(user.id);
    expect(submission?.status).toBe("PENDING");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
  });

  it("renvoie null et laisse le profil INCOMPLETE si les pieces manquent", async () => {
    const user = await createUser("incomplete@pr.test", { firstName: "A", lastName: "B", structure: "S" });
    expect(await submitProfile(user.id)).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("INCOMPLETE");
  });

  it("ne cree pas de doublon si les pieces sont inchangees", async () => {
    const user = await createUser("nodup@pr.test");
    await submitProfile(user.id);
    await submitProfile(user.id);
    expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(1);
  });

  it("cree une nouvelle soumission apres un rejet", async () => {
    const user = await createUser("resubmit@pr.test");
    const staff = await createUser("staff-resubmit@pr.test");
    await submitProfile(user.id);
    await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: (await createReason("PROFILE")).id });
    await prisma.user.update({
      where: { id: user.id },
      data: { idDocument: "profile/u1/documents/d2.pdf" },
    });
    await submitProfile(user.id);
    expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(2);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
  });

  it("renvoie null pour un utilisateur inexistant", async () => {
    expect(await submitProfile("missing-user")).toBeNull();
  });
});

describe("approveProfile", () => {
  it("approuve la soumission courante et bascule le profil en APPROVED", async () => {
    const user = await createUser("approve@pr.test");
    const staff = await createUser("staff-approve@pr.test");
    await submitProfile(user.id);
    const decided = await approveProfile({ userId: user.id, reviewerId: staff.id });
    expect(decided.status).toBe("APPROVED");
    expect(decided.reviewedById).toBe(staff.id);
    expect(decided.reviewedAt).not.toBeNull();
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("APPROVED");
  });

  it("refuse s'il n'y a pas de soumission en attente", async () => {
    const user = await createUser("nopending@pr.test");
    const staff = await createUser("staff-nopending@pr.test");
    await expect(approveProfile({ userId: user.id, reviewerId: staff.id })).rejects.toMatchObject({
      code: "NO_PENDING_SUBMISSION",
    });
  });
});

describe("rejectProfile", () => {
  it("rejette avec le motif catalogue et fige son libelle", async () => {
    const user = await createUser("reject@pr.test");
    const staff = await createUser("staff-reject@pr.test");
    const reason = await createReason("PROFILE", "Piece illisible");
    await submitProfile(user.id);
    const decided = await rejectProfile({
      userId: user.id,
      reviewerId: staff.id,
      reasonId: reason.id,
      details: "Le numero est masque.",
    });
    expect(decided.status).toBe("REJECTED");
    expect(decided.rejectionReasonLabel).toBe("Piece illisible");
    expect(decided.rejectionDetails).toBe("Le numero est masque.");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("REJECTED");
  });

  it("accepte un motif de portee BOTH", async () => {
    const user = await createUser("reject-both@pr.test");
    const staff = await createUser("staff-both@pr.test");
    const reason = await createReason("BOTH", "Document suspecte");
    await submitProfile(user.id);
    const decided = await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id });
    expect(decided.rejectionReasonLabel).toBe("Document suspecte");
  });

  it("refuse un motif de portee REGISTRATION", async () => {
    const user = await createUser("reject-scope@pr.test");
    const staff = await createUser("staff-scope@pr.test");
    const reason = await createReason("REGISTRATION", "Quota atteint");
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "REASON_WRONG_SCOPE" });
  });

  it("refuse un motif inconnu", async () => {
    const user = await createUser("reject-unknown@pr.test");
    const staff = await createUser("staff-unknown@pr.test");
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: "missing" }),
    ).rejects.toMatchObject({ code: "REASON_NOT_FOUND" });
  });

  it("refuse un motif archive", async () => {
    const user = await createUser("reject-archived@pr.test");
    const staff = await createUser("staff-archived@pr.test");
    const reason = await prisma.rejectionReason.create({
      data: { label: "Motif retire", scope: "PROFILE", archived: true, archivedAt: new Date() },
    });
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "REASON_NOT_FOUND" });
  });

  it("refuse s'il n'y a pas de soumission en attente", async () => {
    const user = await createUser("reject-nopending@pr.test");
    const staff = await createUser("staff-reject-nopending@pr.test");
    const reason = await createReason("PROFILE");
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "NO_PENDING_SUBMISSION" });
  });
});

describe("getCurrentSubmission", () => {
  it("renvoie la soumission la plus recente", async () => {
    const user = await createUser("current@pr.test");
    await submitProfile(user.id);
    const current = await getCurrentSubmission(user.id);
    expect(current?.userId).toBe(user.id);
  });

  it("renvoie null sans soumission", async () => {
    const user = await createUser("current-none@pr.test");
    expect(await getCurrentSubmission(user.id)).toBeNull();
  });

  it("preserve l'immuabilite des soumissions passees", async () => {
    const user = await createUser("immutable@pr.test");
    const staff = await createUser("staff-immutable@pr.test");
    const first = await submitProfile(user.id);
    await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: (await createReason("PROFILE")).id });
    await prisma.user.update({ where: { id: user.id }, data: { photo: "profile/u1/photos/p2.png" } });
    await submitProfile(user.id);
    const reloaded = await prisma.profileSubmission.findUnique({ where: { id: first!.id } });
    expect(reloaded?.photo).toBe("profile/u1/photos/p.png");
    expect(reloaded?.status).toBe("REJECTED");
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run : `make test -- src/lib/__tests__/profile-review.test.ts`
Attendu : FAIL — `Cannot find module '@/lib/profile-review'`.

- [ ] **Step 3 : Ecrire l'implementation**

Creer `src/lib/profile-review.ts` :

```ts
import type { ProfileSubmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isParticipantProfileComplete } from "@/lib/participant-profile";

export class ProfileReviewError extends Error {
  constructor(
    public code: "NO_PENDING_SUBMISSION" | "REASON_NOT_FOUND" | "REASON_WRONG_SCOPE",
    public httpStatus: number,
  ) {
    super(code);
  }
}

const PIECES_SELECT = {
  photo: true,
  idDocumentType: true,
  idDocumentNumber: true,
  idDocument: true,
} as const;

export async function getCurrentSubmission(userId: string): Promise<ProfileSubmission | null> {
  return prisma.profileSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// Cree une soumission si les pieces du profil different de la derniere soumise.
// Renvoie null si le profil est incomplet ou si rien n'a change.
export async function submitProfile(userId: string): Promise<ProfileSubmission | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...PIECES_SELECT, firstName: true, lastName: true, structure: true },
  });
  if (!user) return null;
  if (!isParticipantProfileComplete(user)) return null;

  const current = await getCurrentSubmission(userId);
  const unchanged =
    current !== null &&
    current.photo === user.photo &&
    current.idDocumentType === user.idDocumentType &&
    current.idDocumentNumber === user.idDocumentNumber &&
    current.idDocument === user.idDocument;
  if (unchanged) return current;

  const submission = await prisma.profileSubmission.create({
    data: {
      userId,
      photo: user.photo!,
      idDocumentType: user.idDocumentType!,
      idDocumentNumber: user.idDocumentNumber!,
      idDocument: user.idDocument!,
      status: "PENDING",
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { profileStatus: "PENDING" } });
  return submission;
}

async function decidePending(
  userId: string,
  data: Parameters<typeof prisma.profileSubmission.update>[0]["data"],
): Promise<ProfileSubmission> {
  const current = await getCurrentSubmission(userId);
  if (!current || current.status !== "PENDING") {
    throw new ProfileReviewError("NO_PENDING_SUBMISSION", 409);
  }
  return prisma.profileSubmission.update({ where: { id: current.id }, data });
}

export async function approveProfile(args: {
  userId: string;
  reviewerId: string;
}): Promise<ProfileSubmission> {
  const decided = await decidePending(args.userId, {
    status: "APPROVED",
    reviewedById: args.reviewerId,
    reviewedAt: new Date(),
    rejectionReasonId: null,
    rejectionReasonLabel: null,
    rejectionDetails: null,
  });
  await prisma.user.update({ where: { id: args.userId }, data: { profileStatus: "APPROVED" } });
  return decided;
}

export async function rejectProfile(args: {
  userId: string;
  reviewerId: string;
  reasonId: string;
  details?: string;
}): Promise<ProfileSubmission> {
  const reason = await prisma.rejectionReason.findFirst({
    where: { id: args.reasonId, archived: false },
  });
  if (!reason) throw new ProfileReviewError("REASON_NOT_FOUND", 400);
  if (reason.scope === "REGISTRATION") throw new ProfileReviewError("REASON_WRONG_SCOPE", 400);

  const decided = await decidePending(args.userId, {
    status: "REJECTED",
    reviewedById: args.reviewerId,
    reviewedAt: new Date(),
    rejectionReasonId: reason.id,
    rejectionReasonLabel: reason.label,
    rejectionDetails: args.details ?? null,
  });
  await prisma.user.update({ where: { id: args.userId }, data: { profileStatus: "REJECTED" } });
  return decided;
}
```

L'ordre des controles dans `rejectProfile` (motif d'abord, soumission ensuite) est impose par le test « refuse un motif inconnu » : il attend `REASON_NOT_FOUND` meme lorsqu'une soumission en attente existe.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- src/lib/__tests__/profile-review.test.ts`
Attendu : PASS, tous les tests du fichier verts.

- [ ] **Step 5 : Verifier la couverture du module**

Run : `make test-coverage`
Attendu : `src/lib/profile-review.ts` a 100% sur les quatre metriques. Si une branche manque, ajouter le test correspondant — ne jamais ajouter d'exclusion.

- [ ] **Step 6 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/lib/profile-review.ts src/lib/__tests__/profile-review.test.ts
git commit -m "feat(v4): helper de validation des profils participants"
```

---

## Task 3 : API du catalogue des motifs de rejet

**Files:**
- Create: `src/app/api/platform/rejection-reasons/route.ts` (GET, POST)
- Create: `src/app/api/platform/rejection-reasons/[id]/route.ts` (PATCH, DELETE)
- Create: `src/lib/__tests__/api-platform-rejection-reasons.test.ts`

**Interfaces:**
- Consomme : `withStaffAuth` (`src/lib/with-staff-auth.ts`), `logActivity`, model `RejectionReason` (Task 1).
- Produit : les endpoints consommes par les Tasks 5, 7 et 8. Reponse GET : `{ reasons: RejectionReason[] }`, filtrable par `?scope=PROFILE|REGISTRATION` (un motif `BOTH` remonte dans les deux filtres) et `?archived=true`.

- [ ] **Step 1 : Ecrire les tests en echec**

Creer `src/lib/__tests__/api-platform-rejection-reasons.test.ts` en suivant la structure de `src/lib/__tests__/api-platform-plans.test.ts` (mock de `next-auth`, seed via Prisma). Couvrir :

| Cas | Attendu |
|---|---|
| GET sans session | 401 |
| GET en `STAFF_OBSERVER` | 200, liste triee par `sortOrder` croissant |
| GET `?scope=PROFILE` | ne renvoie que les motifs `PROFILE` et `BOTH` |
| GET `?scope=REGISTRATION` | ne renvoie que les motifs `REGISTRATION` et `BOTH` |
| GET par defaut | exclut les motifs archives ; `?archived=true` ne renvoie qu'eux |
| POST en `STAFF_SUPPORT` | 403 (administration reservee a `STAFF_ADMIN` et au-dessus) |
| POST en `STAFF_ADMIN`, corps valide | 201, motif cree, `logActivity` de type `REJECTION_REASON_CREATED` |
| POST corps invalide (`label` vide, `scope` hors enum) | 400 |
| PATCH en `STAFF_ADMIN` | 200, libelle et ordre mis a jour, `REJECTION_REASON_UPDATED` |
| PATCH sur un id inconnu | 404 |
| DELETE en `STAFF_ADMIN` | 200, `archived = true` et `archivedAt` renseigne (soft delete), `REJECTION_REASON_ARCHIVED` |
| DELETE sur un id inconnu | 404 |

Asserer explicitement, pour le soft delete, que la ligne **existe toujours** en base et qu'un `ProfileSubmission` qui la reference conserve son `rejectionReasonLabel`.

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run : `make test -- src/lib/__tests__/api-platform-rejection-reasons.test.ts`
Attendu : FAIL — modules introuvables.

- [ ] **Step 3 : Implementer la route de collection**

Creer `src/app/api/platform/rejection-reasons/route.ts` :

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const scope = searchParams.get("scope");

  const where: { archived: boolean; scope?: { in: ("PROFILE" | "REGISTRATION" | "BOTH")[] } } = {
    archived,
  };
  if (scope === "PROFILE") where.scope = { in: ["PROFILE", "BOTH"] };
  if (scope === "REGISTRATION") where.scope = { in: ["REGISTRATION", "BOTH"] };

  const reasons = await prisma.rejectionReason.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ reasons });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  scope: z.enum(["PROFILE", "REGISTRATION", "BOTH"]),
  sortOrder: z.number().int().min(0).optional(),
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const reason = await prisma.rejectionReason.create({
      data: {
        label: parsed.data.label,
        scope: parsed.data.scope,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });
    await logActivity({
      type: "REJECTION_REASON_CREATED",
      userId: session.user.id,
      targetId: reason.id,
      details: { label: reason.label, scope: reason.scope },
      staffActor: true,
      req,
    });
    return NextResponse.json({ reason }, { status: 201 });
  },
  { minRole: "STAFF_ADMIN" },
);
```

Verifier la signature exacte de `logActivity` (`src/lib/activity-log.ts`) avant d'y passer `staffActor` ; si le champ n'est pas un parametre accepte, l'omettre.

- [ ] **Step 4 : Implementer la route d'element**

Creer `src/app/api/platform/rejection-reasons/[id]/route.ts` avec `PATCH` (label, scope, sortOrder, tous optionnels ; 404 si inconnu ; `REJECTION_REASON_UPDATED`) et `DELETE` (soft delete `archived: true, archivedAt: new Date()` ; 404 si inconnu ; `REJECTION_REASON_ARCHIVED`), tous deux gardes par `{ minRole: "STAFF_ADMIN" }`.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- src/lib/__tests__/api-platform-rejection-reasons.test.ts`
Attendu : PASS.

- [ ] **Step 6 : Verifier la couverture**

Run : `make test-coverage`
Attendu : les deux nouveaux fichiers de route a 100%.

- [ ] **Step 7 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/api/platform/rejection-reasons src/lib/__tests__/api-platform-rejection-reasons.test.ts
git commit -m "feat(v4): api du catalogue des motifs de rejet"
```

---

## Task 4 : Soumission cote participant

**Files:**
- Modify: `src/app/api/account/profile/route.ts` (PUT)
- Modify: `src/lib/__tests__/` — fichier couvrant `PUT /api/account/profile` (le reperer par `grep -rln "account/profile" src/lib/__tests__ src/app/api/account/__tests__`)

**Interfaces:**
- Consomme : `submitProfile`, `getCurrentSubmission` (Task 2).
- Produit : la reponse `GET /api/account/profile` expose desormais `profileStatus` et la soumission courante ; consommee par la Task 8.

- [ ] **Step 1 : Ecrire les tests en echec**

Ajouter au fichier de tests de la route :

```ts
it("cree une soumission de profil quand les pieces deviennent completes", async () => {
  const user = await createUserWithoutPieces("submit@profile.test");
  await withSession(user);
  const res = await PUT(putRequest({ photo: "profile/x/photos/p.png", idDocument: "profile/x/documents/d.pdf", idDocumentType: "CNI", idDocumentNumber: "AB1" }));
  expect(res.status).toBe(200);
  const submissions = await prisma.profileSubmission.findMany({ where: { userId: user.id } });
  expect(submissions).toHaveLength(1);
  expect(submissions[0].status).toBe("PENDING");
  expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
});

it("ne cree pas de soumission quand seuls les champs non lies a l'identite changent", async () => {
  const user = await createApprovedUser("stable@profile.test");
  await withSession(user);
  const res = await PUT(putRequest({ structure: "Nouvelle structure" }));
  expect(res.status).toBe(200);
  expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(1);
  expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("APPROVED");
});

it("repasse en PENDING quand la piece d'identite est remplacee", async () => {
  const user = await createApprovedUser("newdoc@profile.test");
  await withSession(user);
  const res = await PUT(putRequest({ idDocument: "profile/x/documents/d2.pdf" }));
  expect(res.status).toBe(200);
  expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(2);
  expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
});

it("expose le statut du profil et la soumission courante en GET", async () => {
  const user = await createApprovedUser("status@profile.test");
  await withSession(user);
  const res = await GET(getRequest());
  const json = await res.json();
  expect(json.user.profileStatus).toBe("APPROVED");
  expect(json.currentSubmission.status).toBe("APPROVED");
});
```

Ecrire les helpers `createUserWithoutPieces`, `createApprovedUser`, `putRequest`, `getRequest` dans le fichier, en suivant les conventions deja presentes.

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run : `make test -- <fichier de tests>`
Attendu : FAIL.

- [ ] **Step 3 : Brancher la soumission dans le PUT**

Dans `src/app/api/account/profile/route.ts`, apres le `prisma.user.update` et avant le `logActivity` :

```ts
  // v4 (plan 08) : toute modification des pieces cree une nouvelle soumission et
  // repasse le profil en attente de validation. Les champs non lies a l'identite
  // (nom, prenom, structure) ne declenchent rien : submitProfile compare les pieces.
  await submitProfile(session.id);
```

Importer `submitProfile` depuis `@/lib/profile-review`.

- [ ] **Step 4 : Exposer le statut dans le GET**

Ajouter `profileStatus: true` a `SAFE_USER_SELECT` et enrichir la reponse du GET :

```ts
    const currentSubmission = await getCurrentSubmission(session.id);
    return NextResponse.json({
      user,
      currentSubmission: currentSubmission
        ? {
            id: currentSubmission.id,
            status: currentSubmission.status,
            rejectionReasonLabel: currentSubmission.rejectionReasonLabel,
            rejectionDetails: currentSubmission.rejectionDetails,
            createdAt: currentSubmission.createdAt,
            reviewedAt: currentSubmission.reviewedAt,
          }
        : null,
    });
```

Ne pas exposer `reviewedById` : l'identite du valideur ne regarde pas le participant.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- <fichier de tests>`
Attendu : PASS.

- [ ] **Step 6 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert, couverture a 100%.

- [ ] **Step 7 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/api/account/profile/route.ts src/lib/__tests__/
git commit -m "feat(v4): soumission de profil a chaque changement de piece"
```

---

## Task 5 : API de moderation plateforme et emails

**Files:**
- Create: `src/app/api/platform/profiles/route.ts` (GET)
- Create: `src/app/api/platform/profiles/[userId]/route.ts` (GET detail + historique)
- Create: `src/app/api/platform/profiles/[userId]/approve/route.ts` (POST)
- Create: `src/app/api/platform/profiles/[userId]/reject/route.ts` (POST)
- Create: `src/lib/__tests__/api-platform-profiles.test.ts`
- Modify: `src/lib/mail.ts` (deux nouveaux envois)
- Modify: `src/lib/__tests__/mail.test.ts`

**Interfaces:**
- Consomme : `withStaffAuth`, `approveProfile` / `rejectProfile` / `getCurrentSubmission` / `ProfileReviewError` (Task 2), catalogue (Task 3).
- Produit : `sendProfileApproved(userId: string): Promise<void>` et `sendProfileRejected(userId: string): Promise<void>` dans `src/lib/mail.ts` ; endpoints consommes par la Task 7.

- [ ] **Step 1 : Ecrire les tests d'API en echec**

Creer `src/lib/__tests__/api-platform-profiles.test.ts`. Couvrir :

| Cas | Attendu |
|---|---|
| GET liste sans session | 401 |
| GET liste en `STAFF_OBSERVER` | 200, profils `PENDING` par defaut, `?status=REJECTED` filtre |
| GET liste, recherche `?q=` | filtre sur nom, e-mail et numero de piece |
| GET detail | 200 avec profil, soumission courante et **historique complet** trie du plus recent au plus ancien |
| GET detail id inconnu | 404 |
| POST approve en `STAFF_OBSERVER` | 403 |
| POST approve en `STAFF_SUPPORT` | 200, `profileStatus = APPROVED`, `logActivity` `PROFILE_APPROVED`, e-mail envoye |
| POST approve sans soumission en attente | 409 `NO_PENDING_SUBMISSION` |
| POST reject en `STAFF_SUPPORT` avec motif `PROFILE` | 200, `profileStatus = REJECTED`, libelle fige, `PROFILE_REJECTED`, e-mail envoye |
| POST reject avec motif de portee `REGISTRATION` | 400 `REASON_WRONG_SCOPE` |
| POST reject sans `reasonId` | 400 `VALIDATION` |
| POST reject motif inconnu | 400 `REASON_NOT_FOUND` |

Mocker `@/lib/mail` comme le fait `src/app/api/account/__tests__/registrations.test.ts` et asserer les appels.

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run : `make test -- src/lib/__tests__/api-platform-profiles.test.ts`
Attendu : FAIL — modules introuvables.

- [ ] **Step 3 : Implementer la liste**

`src/app/api/platform/profiles/route.ts`, garde `withStaffAuth` par defaut (`STAFF_OBSERVER`) :

```ts
export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const q = searchParams.get("q")?.trim();

  const where: Prisma.UserWhereInput = {
    isStaff: false,
    profileStatus: status as ProfileStatus,
  };
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { idDocumentNumber: { contains: q } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      profileStatus: true,
      idDocumentType: true,
      idDocumentNumber: true,
    },
  });
  return NextResponse.json({ users });
});
```

Valider `status` contre l'enum et renvoyer 400 sur une valeur inconnue — ajouter le test correspondant.

- [ ] **Step 4 : Implementer le detail**

`src/app/api/platform/profiles/[userId]/route.ts` : 404 si l'utilisateur n'existe pas ou est staff ; sinon profil complet (y compris `photo` et `idDocument`, lisibles par le staff) et `submissions` triees par `createdAt` decroissant.

- [ ] **Step 5 : Implementer approbation et rejet**

Les deux routes sont gardees par `{ minRole: "STAFF_SUPPORT" }`, appellent le helper de la Task 2, traduisent `ProfileReviewError` en reponse HTTP via son `httpStatus` et son `code`, journalisent, puis declenchent l'e-mail sans bloquer la reponse :

```ts
export const POST = withStaffAuth(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    const parsed = rejectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    try {
      const submission = await rejectProfile({
        userId,
        reviewerId: session.user.id,
        reasonId: parsed.data.reasonId,
        details: parsed.data.details,
      });
      await logActivity({
        type: "PROFILE_REJECTED",
        userId: session.user.id,
        targetId: userId,
        details: { reason: submission.rejectionReasonLabel, submissionId: submission.id },
        req,
      });
      sendProfileRejected(userId).catch((err) =>
        console.error("[mail] sendProfileRejected failed", err),
      );
      return NextResponse.json({ submission });
    } catch (err) {
      if (err instanceof ProfileReviewError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }
  },
  { minRole: "STAFF_SUPPORT" },
);
```

avec `const rejectSchema = z.object({ reasonId: z.string().min(1), details: z.string().max(2000).optional() });`.

- [ ] **Step 6 : Ecrire les tests d'emails en echec**

Ajouter dans `src/lib/__tests__/mail.test.ts` deux tests calques sur ceux de `sendStatusNotification` : `sendProfileApproved` envoie a l'adresse du participant un message contenant le titre « Profil valide » ; `sendProfileRejected` contient le libelle du motif et les details, et ne contient **aucune** cle de stockage de document.

- [ ] **Step 7 : Implementer les deux envois**

Dans `src/lib/mail.ts`, sur le modele de `sendStatusNotification` : lecture de l'utilisateur et de sa soumission courante, sortie silencieuse avec `console.error` si absent, construction du corps via `buildEmail`, envoi via `safeSend`. Le message de rejet renvoie vers `/account/profile`.

- [ ] **Step 8 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- src/lib/__tests__/api-platform-profiles.test.ts src/lib/__tests__/mail.test.ts`
Attendu : PASS.

- [ ] **Step 9 : Verification complete**

Run : `make lint && make typecheck && make test-coverage`
Attendu : tout vert, 100% sur les nouvelles routes et sur les nouveaux envois de `mail.ts`.

- [ ] **Step 10 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/api/platform/profiles src/lib/mail.ts src/lib/__tests__/
git commit -m "feat(v4): api de moderation des profils et notifications"
```

---

## Task 6 : Gate d'inscription et gel de l'approbation

**Files:**
- Modify: `src/app/api/events/[slug]/register/route.ts`
- Modify: `src/app/e/[slug]/register/page.tsx`
- Modify: `src/app/api/account/registrations/[id]/resubmit/route.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (POST, creation par le staff d'org)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route.ts`
- Modify: `src/lib/__tests__/api-event-registrations.test.ts`, `src/app/api/events/__tests__/register-event.test.ts`, `src/app/api/account/__tests__/registrations.test.ts`

**Interfaces:**
- Consomme : `User.profileStatus` (Task 1), catalogue (Task 3).
- Produit : le code d'erreur `PROFILE_NOT_APPROVED` (403 a l'inscription, 409 a l'approbation), consomme par les Tasks 8 et 9.

- [ ] **Step 1 : Ecrire les tests de gate en echec**

Dans `src/app/api/events/__tests__/register-event.test.ts` :

```ts
it("refuse l'inscription si le profil n'est pas approuve", async () => {
  const user = await createCompleteUser("pending@gate.test"); // profileStatus par defaut
  await withSession(user);
  const res = await POST(registerRequest(), { params: Promise.resolve({ slug }) });
  expect(res.status).toBe(403);
  expect((await res.json()).code).toBe("PROFILE_NOT_APPROVED");
  expect(await prisma.registration.count({ where: { userId: user.id } })).toBe(0);
});

it("accepte l'inscription quand le profil est approuve", async () => {
  const user = await createCompleteUser("approved@gate.test");
  await prisma.user.update({ where: { id: user.id }, data: { profileStatus: "APPROVED" } });
  await withSession(user);
  const res = await POST(registerRequest(), { params: Promise.resolve({ slug }) });
  expect(res.status).toBe(201);
});
```

Ajouter le meme couple de cas pour la resoumission (`/api/account/registrations/[id]/resubmit`) et pour la creation par le staff d'organisation (`POST …/registrations`, ou l'inscription porte sur un **autre** utilisateur : c'est le `profileStatus` de la cible qui compte, pas celui de l'acteur).

Pour l'approbation :

```ts
it("gele l'approbation quand le profil du participant n'est plus approuve", async () => {
  // registration PENDING creee avec un profil APPROVED, puis profil rejete
  await prisma.user.update({ where: { id: participant.id }, data: { profileStatus: "REJECTED" } });
  const res = await POST(approveRequest(), { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId }) });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe("PROFILE_NOT_APPROVED");
  expect((await prisma.registration.findUnique({ where: { id: regId } }))?.status).toBe("PENDING");
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run : `make test -- src/app/api/events/__tests__/register-event.test.ts`
Attendu : FAIL — les inscriptions passent encore sans controle.

- [ ] **Step 3 : Implementer le gate d'inscription**

Dans `src/app/api/events/[slug]/register/route.ts`, ajouter `profileStatus: true` au `select` de l'utilisateur, puis juste apres le controle de profil complet :

```ts
    // v4 (plan 08) : l'identite est validee par le staff plateforme, en amont de
    // toute inscription.
    if (user.profileStatus !== "APPROVED") {
      return NextResponse.json(
        {
          code: "PROFILE_NOT_APPROVED",
          error: "Votre profil doit être validé par la plateforme avant de vous inscrire.",
        },
        { status: 403 },
      );
    }
```

Appliquer le meme controle dans `resubmit/route.ts` et dans le `POST` de creation par le staff d'organisation (sur l'utilisateur cible ; message : « Le profil de ce participant n'est pas validé. »).

- [ ] **Step 4 : Implementer le gel de l'approbation**

Dans `approve/route.ts`, avant la mise a jour du statut :

```ts
  const participant = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { profileStatus: true },
  });
  if (participant?.profileStatus !== "APPROVED") {
    return NextResponse.json({ error: "PROFILE_NOT_APPROVED" }, { status: 409 });
  }
```

`existing` est la registration deja chargee par la route ; si elle ne selectionne pas `userId`, l'ajouter.

- [ ] **Step 5 : Rediriger cote page d'inscription**

Dans `src/app/e/[slug]/register/page.tsx`, ajouter `profileStatus: true` au `select` et, apres le controle de completude :

```tsx
  if (user.profileStatus !== "APPROVED") {
    redirect(`/account/profile?pending=1&next=/e/${slug}/register`);
  }
```

- [ ] **Step 6 : Basculer le rejet d'inscription sur le catalogue**

Dans `reject/route.ts`, remplacer le schema de saisie libre par :

```ts
const schema = z.object({
  reasonId: z.string().min(1),
  details: z.string().max(2000).optional(),
});
```

puis charger le motif (`archived: false`, portee `REGISTRATION` ou `BOTH` — sinon 400 `REASON_WRONG_SCOPE`, 400 `REASON_NOT_FOUND` si inconnu) et ecrire `rejectionReasonId: reason.id` **et** `rejectionReason: reason.label` sur la registration. Ajouter les tests correspondants dans `src/lib/__tests__/api-event-registrations.test.ts` et mettre a jour les tests existants qui envoyaient `{ reason: "..." }`.

- [ ] **Step 7 : Lancer les tests et verifier qu'ils passent**

Run : `make test`
Attendu : PASS. Plusieurs tests existants d'inscription vont echouer tant qu'ils ne mettent pas leur utilisateur en `profileStatus: "APPROVED"` : les mettre a jour — c'est un changement de pre-condition metier, pas un contournement.

- [ ] **Step 8 : Verification complete**

Run : `make lint && make typecheck && make test-coverage`
Attendu : tout vert, 100%.

- [ ] **Step 9 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/api src/app/e src/lib/__tests__/
git commit -m "feat(v4): gate d'inscription sur profil approuve et gel de l'approbation"
```

---

## Task 7 : UI plateforme

**Files:**
- Create: `src/app/platform/profiles/page.tsx`
- Create: `src/app/platform/profiles/[userId]/page.tsx`
- Create: `src/components/staff/ProfileReviewPanel.tsx`
- Create: `src/components/staff/RejectionReasonsManager.tsx`
- Modify: `src/components/staff/StaffShell.tsx` (tableau `NAV`)
- Modify: `src/app/platform/settings/page.tsx`

**Interfaces:**
- Consomme : endpoints des Tasks 3 et 5, `DocumentPreview` (plan 06), `StatusBadge`, `Card`, `KeyValue`, `Button`.
- Produit : rien pour les tasks suivantes.

- [ ] **Step 1 : Ajouter l'entree de navigation**

Dans `src/components/staff/StaffShell.tsx`, inserer dans `NAV` apres « Organisations » :

```ts
  { href: "/platform/profiles", label: "Profils", icon: "user-check" },
```

Verifier que `user-check` existe dans `IconName` (`grep -n "user-check" src/components/ui/Icon.tsx`).

- [ ] **Step 2 : Creer la file d'attente**

`src/app/platform/profiles/page.tsx` — Server Component listant les profils via Prisma (meme filtre que l'API : `isStaff: false`, `profileStatus` selectionne par un filtre d'onglets `PENDING` / `REJECTED` / `APPROVED`), avec recherche et lien vers le detail. Suivre la structure de `src/app/platform/users/page.tsx` pour la mise en page et les composants.

- [ ] **Step 3 : Creer l'ecran de detail**

`src/app/platform/profiles/[userId]/page.tsx` — charge le profil, la soumission courante et l'historique, puis rend `<ProfileReviewPanel />`. 404 (`notFound()`) si l'utilisateur n'existe pas ou est staff.

- [ ] **Step 4 : Creer le panneau de decision**

`src/components/staff/ProfileReviewPanel.tsx` (Client Component) :
- en-tete : identite, e-mail, structure, `StatusBadge` du `profileStatus` ;
- bloc « Pieces soumises » : `<DocumentPreview storageKey={submission.photo} label="Photo" />` et `<DocumentPreview storageKey={submission.idDocument} label="Pièce d'identité" />`, plus type et numero ;
- actions (visibles seulement si la soumission courante est `PENDING`) : bouton **Approuver** (POST `approve`) et bouton **Rejeter** ouvrant un formulaire avec un `<select>` alimente par `GET /api/platform/rejection-reasons?scope=PROFILE` et un `<textarea>` de details ; le bouton de soumission est desactive tant qu'aucun motif n'est choisi ;
- bloc « Historique des soumissions » : une ligne par soumission (date, statut, motif fige, details, date de decision), de la plus recente a la plus ancienne ;
- affichage du message d'erreur renvoye par l'API en cas d'echec (`NO_PENDING_SUBMISSION`, `REASON_WRONG_SCOPE`), et `router.refresh()` en cas de succes.

- [ ] **Step 5 : Creer le gestionnaire de motifs**

`src/components/staff/RejectionReasonsManager.tsx` (Client Component), calque sur `src/components/staff/PlanManager.tsx` : liste triee, creation (libelle, portee, ordre), edition en ligne, archivage avec confirmation. Les actions d'ecriture ne sont affichees que si l'utilisateur est `STAFF_ADMIN` ou `SUPER_ADMIN` — passer un booleen `canManage` depuis la page serveur, comme le fait deja `canEditSecrets` dans `src/app/platform/settings/page.tsx`.

- [ ] **Step 6 : Integrer aux parametres plateforme**

Dans `src/app/platform/settings/page.tsx`, ajouter une section « Motifs de rejet » sous les formulaires existants, alimentee par `prisma.rejectionReason.findMany({ where: { archived: false }, orderBy: [{ sortOrder: "asc" }] })` et rendant `<RejectionReasonsManager initial={reasons} canManage={canManage} />`.

- [ ] **Step 7 : Verification**

Run : `make lint && make typecheck && make test`
Attendu : tout vert.

- [ ] **Step 8 : Verification navigateur**

`make db-seed`, se connecter en `SUPER_ADMIN` :
- `/platform/profiles` : la file d'attente affiche le participant `PENDING` seede ;
- ouvrir son detail : les deux apercus s'affichent (le staff a le droit de lire les documents de profil), l'historique est present ;
- rejeter avec un motif : le statut bascule, l'e-mail arrive dans Mailpit (`http://mail.badge.local`) ;
- `/platform/settings` : creer, renommer puis archiver un motif ;
- se reconnecter en `STAFF_OBSERVER` : la file est consultable, les boutons Approuver / Rejeter et la gestion des motifs sont absents.

- [ ] **Step 9 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/platform src/components/staff
git commit -m "feat(v4): ecrans plateforme de validation des profils"
```

---

## Task 8 : UI participant et UI organisation

**Files:**
- Modify: `src/app/account/profile/page.tsx`
- Modify: `src/app/account/profile/ProfileForm.tsx`
- Modify: `src/app/account/registrations/[id]/page.tsx`
- Modify: `src/app/event/[eventId]/registrations/[regId]/page.tsx`
- Modify: `src/components/event/RegistrationDetailPanel.tsx`
- Modify: `src/components/event/RegistrationActions.tsx`

**Interfaces:**
- Consomme : `profileStatus` et soumission courante (Task 4), catalogue (Task 3), codes d'erreur de la Task 6.
- Produit : rien.

- [ ] **Step 1 : Afficher le statut du profil au participant**

Dans `src/app/account/profile/page.tsx`, ajouter `profileStatus: true` au `select`, charger la soumission courante et l'historique via `getCurrentSubmission` / `prisma.profileSubmission.findMany`, puis remplacer le bloc « Profil complet ✓ / Profil incomplet » par un bandeau a quatre etats :

| Statut | Message |
|---|---|
| `INCOMPLETE` | « Profil incomplet : complétez tous les champs ci-dessous pour pouvoir vous inscrire. » (ton avertissement) |
| `PENDING` | « Vos documents sont en cours de vérification par la plateforme. Vous pourrez vous inscrire à un événement une fois votre profil validé. » (ton information) |
| `APPROVED` | « Profil validé — vous pouvez vous inscrire aux événements. » (ton succès) |
| `REJECTED` | « Documents refusés : <motif>. <details> — corrigez-les puis enregistrez pour soumettre à nouveau. » (ton erreur) |

Ajouter sous le formulaire un bloc « Historique de mes soumissions » (date, statut, motif, details).

- [ ] **Step 2 : Signaler la resoumission dans le formulaire**

Dans `ProfileForm.tsx`, afficher sous les champs de pieces une note : « Toute modification de la photo ou de la pièce d'identité relance la vérification par la plateforme. »

- [ ] **Step 3 : Expliquer le blocage sur le detail d'inscription**

Dans `src/app/account/registrations/[id]/page.tsx`, si le profil du participant n'est pas `APPROVED` et que l'inscription est `PENDING`, afficher une alerte : « Votre inscription ne peut pas être traitée tant que votre profil n'est pas validé par la plateforme. » avec un lien vers `/account/profile`.

- [ ] **Step 4 : Remplacer l'etat de la piece cote organisation**

Dans `src/app/event/[eventId]/registrations/[regId]/page.tsx`, charger le `profileStatus` et la date de validation du participant (`reviewedAt` de la derniere soumission approuvee) et les transmettre au panneau. Dans `RegistrationDetailPanel.tsx`, remplacer le `DocumentPreview` de la piece par un `FileBox` d'etat : « Pièce d'identité — vérifiée par la plateforme le JJ/MM/AAAA », ou « en attente de vérification » / « refusée par la plateforme » selon le statut. La photo reste en apercu.

- [ ] **Step 5 : Geler visuellement l'approbation**

Dans `RegistrationActions.tsx`, desactiver le bouton **Approuver** quand le profil du participant n'est pas `APPROVED`, avec un libelle explicite a cote : « Profil non validé par la plateforme ». Le controle serveur de la Task 6 reste la source de verite : cette desactivation est une commodite d'interface, pas une garde.

- [ ] **Step 6 : Brancher le catalogue sur le rejet d'inscription**

Toujours dans `RegistrationActions.tsx`, remplacer le champ libre de motif par un `<select>` alimente par `GET /api/platform/rejection-reasons?scope=REGISTRATION`, plus un `<textarea>` de details. Afficher le message d'erreur renvoye par l'API en cas d'echec.

> Note : cet endpoint est garde par `withStaffAuth` et n'est donc pas accessible a un membre d'organisation. Exposer le catalogue filtre aux roles evenement autorises a rejeter, soit en le passant depuis le Server Component parent (recommande : aucune route supplementaire), soit via une route dediee gardee par `withEventAuth`. **Choisir le passage par le Server Component** et faire descendre `reasons` en props jusqu'a `RegistrationActions`.

- [ ] **Step 7 : Verification**

Run : `make lint && make typecheck && make test`
Attendu : tout vert.

- [ ] **Step 8 : Verification navigateur**

`make db-seed`, puis :
- en participant `PENDING` : bandeau de verification, tentative d'inscription a un evenement → redirection vers le profil avec message ;
- en participant `REJECTED` : motif affiche, remplacement de la piece, retour en `PENDING`, historique a deux lignes ;
- en membre d'organisation : bouton Approuver desactive avec l'explication, rejet via le menu deroulant de motifs.

- [ ] **Step 9 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/account src/app/event src/components/event
git commit -m "feat(v4): statut de profil cote participant et organisation"
```

---

## Task 9 : Couverture E2E et documentation

**Files:**
- Create: `e2e/platform/profiles.spec.ts`
- Create: `e2e/platform/profile-detail.spec.ts`
- Modify: `e2e/platform/settings.spec.ts`
- Modify: `e2e/public/account-profile.spec.ts`, `e2e/public/event-register.spec.ts`
- Modify: `e2e/event/registration-detail.spec.ts`
- Modify: `e2e/helpers/db.ts`
- Create: `docs/v4/features/validation-profils.md`
- Modify: `docs/v4/README.md`, `docs/v4/architecture.md`, `docs/v4/features/politique-tests.md`, `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md`

**Interfaces:**
- Consomme : tout ce qui precede.
- Produit : rien.

- [ ] **Step 1 : Etendre les helpers E2E**

Dans `e2e/helpers/db.ts`, ajouter :
- une option `profileStatus?: "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED"` a `createTestUser` (defaut `APPROVED` **uniquement** quand `completeProfile` est demande, afin que les specs existantes d'inscription continuent de passer) ;
- `createTestProfileSubmission(opts)` et `createTestRejectionReason(opts)` ;
- ajouter `profileSubmission` et `rejectionReason` au nettoyage de `cleanupE2ETestData()`, dans le bon ordre de dependances.

- [ ] **Step 2 : Spec E2E — file d'attente plateforme**

`e2e/platform/profiles.spec.ts` : acces et rendu (staff voit la file, le participant seede `PENDING` y figure), filtre par statut, recherche, redirection d'un utilisateur non staff vers son espace.

- [ ] **Step 3 : Spec E2E — decision sur un profil**

`e2e/platform/profile-detail.spec.ts` :
- **approbation** : clic sur Approuver → feedback UI, `profileStatus = APPROVED` en base (`getDb()`), e-mail present dans Mailpit, entree d'audit `PROFILE_APPROVED` (`expectLastActivity`) ;
- **rejet** : selection d'un motif, saisie de details, validation → statut `REJECTED`, libelle fige en base, e-mail recu ;
- **echec** : tentative de rejet sans motif → le bouton reste desactive et rien ne change en base ;
- **role** : un `STAFF_OBSERVER` ne voit ni le bouton Approuver ni le bouton Rejeter.

- [ ] **Step 4 : Spec E2E — parcours participant bloque puis debloque**

Dans `e2e/public/event-register.spec.ts` : un participant `PENDING` qui ouvre `/e/<slug>/register` est redirige vers `/account/profile` (URL assertee) et voit le message de verification ; apres passage du profil en `APPROVED` (via `getDb()`), le meme parcours UI aboutit a une inscription creee.

Dans `e2e/public/account-profile.spec.ts` : apres un rejet, le motif est affiche ; le remplacement de la piece via `setInputFiles` puis l'enregistrement font apparaitre le bandeau « en cours de vérification » et une deuxieme ligne d'historique.

- [ ] **Step 5 : Spec E2E — gel cote organisation**

Dans `e2e/event/registration-detail.spec.ts` : pour une inscription `PENDING` dont le participant est `REJECTED`, le bouton Approuver est desactive et le message « Profil non validé par la plateforme » est visible ; le statut en base reste `PENDING`.

- [ ] **Step 6 : Spec E2E — catalogue de motifs**

Dans `e2e/platform/settings.spec.ts` : creation d'un motif (feedback UI + ligne en base), renommage, archivage (le motif disparait de la liste mais la ligne existe toujours en base), et absence des actions pour un `STAFF_SUPPORT`.

- [ ] **Step 7 : Lancer la suite E2E**

Run : `make test-e2e`
Attendu : les nouvelles specs passent ; aucun **nouvel** echec par rapport a la baseline connue de la suite. Verifier specifiquement les specs d'inscription existantes, sensibles au nouveau gate.

- [ ] **Step 8 : Rediger la fiche de feature**

Creer `docs/v4/features/validation-profils.md` : cycle de vie du profil, roles et permissions, catalogue de motifs, effet du rejet sur les inscriptions, parcours participant, points d'API. Renvoyer vers la spec pour le *pourquoi*.

- [ ] **Step 9 : Mettre a jour la documentation existante**

- `docs/v4/README.md` : entree de plan, entree de feature, ligne d'etat d'avancement.
- `docs/v4/architecture.md` : cycle de vie du profil, gate d'inscription, regle « seul `profile-review.ts` ecrit `profileStatus` ».
- `docs/v4/features/politique-tests.md` : ajouter les nouvelles routes a la matrice RBAC (`/api/platform/profiles*`, `/api/platform/rejection-reasons*`).
- `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md` : nouvelles pages plateforme et nouveaux etats participant.

- [ ] **Step 10 : Verification finale**

Run : `make lint && make typecheck && make test-coverage && make test-e2e`
Attendu : tout vert, couverture a 100% sur `src/lib` et `src/app/api`.

- [ ] **Step 11 : Mettre a jour le tracker**

Passer les neuf lignes du tableau `## Progression` a `[x]` avec la date du jour.

- [ ] **Step 12 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add e2e/ docs/v4/
git commit -m "test(v4): couverture e2e de la validation des profils"
```
