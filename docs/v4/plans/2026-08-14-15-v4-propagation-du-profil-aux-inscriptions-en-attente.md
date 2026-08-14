# Propagation du profil aux inscriptions en attente — Plan d'implémentation

> **Pour les agents** : SOUS-SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes utilisent la syntaxe `- [ ]` pour le suivi.

**Goal :** Une modification du profil participant se répercute sur ses inscriptions en attente, sans jamais toucher une inscription validée, et l'organisation cesse de voir un encart de pièce d'identité qu'elle ne peut pas ouvrir.

**Architecture :** Un module `src/lib/registration-snapshot-sync.ts` recalcule le snapshot cible avec `buildRegistrationSnapshot()`, sélectionne les inscriptions `PENDING` du participant hors événements archivés, saute celles dont l'événement bloque le nouveau numéro de pièce, et réécrit les colonnes `snapshot*`. La route `PUT /api/account/profile` l'appelle après `submitProfile()` puis journalise un `REGISTRATION_SNAPSHOT_REFRESHED` par inscription touchée.

**Tech Stack :** Next.js 16 (App Router), TypeScript 5, Prisma 6 / MySQL 8, Vitest 4, Playwright.

**Spec :** [`docs/v4/specs/2026-08-14-15-v4-propagation-du-profil-aux-inscriptions-en-attente.md`](../specs/2026-08-14-15-v4-propagation-du-profil-aux-inscriptions-en-attente.md)

## Global Constraints

- Version active : **v4**.
- Code, identifiants et types en **anglais** ; commentaires de code et UI en **français accentué** ; noms de fichiers en **ASCII**.
- `src/lib/**` est soumis à un **gate de couverture 100 %** (lignes, branches, fonctions, statements) — `vitest.config.ts`.
- **Aucun mock de Prisma** : les tests utilisent la vraie MySQL de dev, avec le reset global de `src/test-setup.ts` (`beforeEach`).
- `fileParallelism: false` : ne **jamais** lancer deux runs Vitest en parallèle. Chaque `make test` **vide la base de dev** → relancer `make db-seed` pour reprendre l'app manuellement.
- Toute action sensible passe par `logActivity()` ; tout nouveau type d'action exige une valeur dans l'enum `ActivityType` de `prisma/schema.prisma`.
- Avant de considérer une tâche finie : `make lint`, `make typecheck`, `make test`.
- **Étapes marquées « À LA CHARGE DE L'UTILISATEUR »** : en exécution automatisée (`scripts/run-plans.sh`), ne pas les exécuter ni prétendre les avoir vérifiées. Faire ce que l'encadré demande, cocher la case pour ne pas bloquer la boucle, et consigner la mention correspondante dans la colonne Notes de la table `## Progression`, afin que l'utilisateur retrouve la liste de ce qui lui reste à faire.
- **Commits** : aucun commit à l'initiative de l'agent en session interactive — les étapes de vérification remplacent les étapes de commit. Exception unique : une exécution pilotée par `scripts/run-plans.sh`, dont le prompt impose **un commit par tâche validée** ; dans ce cas, un commit par tâche, jamais de lot, jamais après un Verify en échec.

---

## Progression

| Task | Description | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Type d'action `REGISTRATION_SNAPSHOT_REFRESHED` | [x] | 2026-08-14 | 2 tests ; enum propage par `make db-push` |
| 2 | Module de synchronisation — sélection et réécriture | [x] | 2026-08-14 | 6 tests verts |
| 3 | Module de synchronisation — règle de blocage document | [x] | 2026-08-14 | 9 tests ; couverture module 100% (make test-coverage global tombe en OOM, couverture ciblee utilisee) |
| 4 | Branchement dans `PUT /api/account/profile` + audit | [x] | 2026-08-14 | 3 tests API + 1 E2E ; suite complete verte (1549 tests) |
| 5 | Détail d'inscription côté organisation — retrait de l'encart | [x] | 2026-08-14 | 12 tests e2e verts. **Recette visuelle a faire par l'utilisateur.** Ecart : l'assertion `getByText("Photo")` du plan etait ambigue (titre de carte + label d'apercu), remplacee par `getByRole("heading")` |
| 6 | Documentation | [ ] | | |

Statuts : `[ ]` pending · `[~]` in_progress · `[x]` completed · `[-]` abandoned.

---

### Task 1 : Type d'action `REGISTRATION_SNAPSHOT_REFRESHED`

**Files:**
- Modify: `prisma/schema.prisma` (enum `ActivityType`, autour de la ligne 493)
- Modify: `src/lib/activity-labels.ts:6-28` (`logKind`) et `src/lib/activity-labels.ts:30` (`DESCRIPTIONS`)
- Test: `src/lib/__tests__/activity-labels.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit : la valeur d'enum `REGISTRATION_SNAPSHOT_REFRESHED` (type `ActivityType`), utilisée par la Task 4.

Le point de vigilance : `logKind()` classe par suffixe. `REGISTRATION_SNAPSHOT_REFRESHED` se termine par `_REFRESHED`, qui n'est reconnu nulle part — sans ajout explicite il tomberait dans le fallback `"systeme"` alors qu'il s'agit d'une modification de dossier.

- [x] **Étape 1 : Ajouter la valeur à l'enum Prisma**

Dans `prisma/schema.prisma`, enum `ActivityType`, à la suite de `REGISTRATION_RESUBMITTED` :

```prisma
  REGISTRATION_RESUBMITTED
  // v4 (plan 15) : snapshot d'une inscription en attente realigne sur le profil.
  REGISTRATION_SNAPSHOT_REFRESHED
```

- [x] **Étape 2 : Propager le schéma et régénérer le client**

```bash
make db-push
```

Attendu : la commande se termine sans erreur et régénère le client Prisma. `REGISTRATION_SNAPSHOT_REFRESHED` devient disponible dans le type `ActivityType`.

- [x] **Étape 3 : Écrire les tests qui échouent**

Dans `src/lib/__tests__/activity-labels.test.ts`, ajouter `"REGISTRATION_SNAPSHOT_REFRESHED"` à la liste `ALL_ACTIVITY_TYPES` (elle sert à couvrir `describeActivity` pour toutes les valeurs de l'enum), puis ajouter ce bloc :

```ts
describe("REGISTRATION_SNAPSHOT_REFRESHED", () => {
  it("est classe comme une modification", () => {
    expect(logKind("REGISTRATION_SNAPSHOT_REFRESHED" as ActivityType)).toBe("modification");
  });

  it("a un libelle humain", () => {
    expect(describeActivity("REGISTRATION_SNAPSHOT_REFRESHED" as ActivityType)).toBe(
      "Inscription mise a jour depuis le profil",
    );
  });
});
```

- [x] **Étape 4 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/activity-labels.test.ts
```

Attendu : ÉCHEC — `logKind` renvoie `"systeme"` au lieu de `"modification"`, et `describeActivity` renvoie le type brut.

- [x] **Étape 5 : Implémenter**

Dans `src/lib/activity-labels.ts`, étendre la branche « modification » de `logKind` :

```ts
  if (
    s.endsWith("_UPDATED") ||
    s === "REGISTRATION_SNAPSHOT_REFRESHED" ||
    s === "MEMBERSHIP_ROLE_CHANGED" ||
    s.endsWith("SETTINGS_UPDATED") ||
    s === "USER_PASSWORD_SET"
  )
    return "modification";
```

et ajouter le libellé dans `DESCRIPTIONS`, à la suite de `REGISTRATION_DELETED` :

```ts
  REGISTRATION_SNAPSHOT_REFRESHED: "Inscription mise a jour depuis le profil",
```

Le libellé est affiché tel quel dans le journal : il suit le style des libellés voisins.

- [x] **Étape 6 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/activity-labels.test.ts
```

Attendu : SUCCÈS.

- [x] **Étape 7 : Vérifier lint et types**

```bash
make lint && make typecheck
```

Attendu : aucun warning, aucune erreur de type.

---

### Task 2 : Module de synchronisation — sélection et réécriture

**Files:**
- Create: `src/lib/registration-snapshot-sync.ts`
- Test: `src/lib/__tests__/registration-snapshot-sync.test.ts`

**Interfaces:**
- Consomme : `buildRegistrationSnapshot()` et `isParticipantProfileComplete()` de `src/lib/participant-profile.ts`, `prisma` de `src/lib/prisma.ts`.
- Produit :

```ts
export type SnapshotRefreshOutcome =
  | { registrationId: string; eventId: string; orgId: string; outcome: "refreshed"; fields: string[] }
  | { registrationId: string; eventId: string; orgId: string; outcome: "skipped_document_blocked" };

export async function refreshPendingRegistrationSnapshots(
  userId: string,
): Promise<SnapshotRefreshOutcome[]>;
```

La Task 3 complète cette même fonction avec la règle de blocage ; la Task 4 la consomme depuis la route.

- [x] **Étape 1 : Écrire les tests qui échouent**

Créer `src/lib/__tests__/registration-snapshot-sync.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { refreshPendingRegistrationSnapshots } from "@/lib/registration-snapshot-sync";

let counter = 0;

// Profil complet : buildRegistrationSnapshot() exige les sept champs.
async function makeParticipant(scope: string) {
  return prisma.user.create({
    data: {
      email: `p-${scope}@sync.test`,
      password: "x",
      name: "P",
      firstName: "Ancien",
      lastName: "Nom",
      structure: "Ancienne structure",
      photo: "profile/u/photos/old.jpg",
      idDocumentType: "CNI",
      idDocumentNumber: "OLD-1",
      idDocument: "profile/u/documents/old.pdf",
      profileStatus: "APPROVED",
    },
  });
}

async function makeEvent(scope: string, opts?: { archived?: boolean }) {
  const org = await prisma.organization.create({
    data: { name: `Org ${scope}`, slug: `org-${scope}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Event",
      slug: `event-${scope}`,
      location: "L",
      date: new Date("2026-12-15"),
      archived: opts?.archived ?? false,
    },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Cat", color: "#123456", number: 1 },
  });
  return { orgId: org.id, eventId: event.id, categoryId: category.id };
}

async function makeRegistration(args: {
  userId: string;
  eventId: string;
  categoryId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}) {
  counter += 1;
  return prisma.registration.create({
    data: {
      id: `reg-sync-${counter}`,
      userId: args.userId,
      eventId: args.eventId,
      categoryId: args.categoryId,
      status: args.status ?? "PENDING",
      snapshotFirstName: "Ancien",
      snapshotLastName: "Nom",
      snapshotEmail: "fige@sync.test",
      snapshotStructure: "Ancienne structure",
      snapshotPhoto: "uploads/legacy/old.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "OLD-1",
      snapshotIdDocument: "profile/u/documents/old.pdf",
    },
  });
}

describe("refreshPendingRegistrationSnapshots", () => {
  it("realigne une inscription en attente sur le profil", async () => {
    const user = await makeParticipant("a");
    const { orgId, eventId, categoryId } = await makeEvent("a");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg", structure: "Nouvelle structure" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      {
        registrationId: reg.id,
        eventId,
        orgId,
        outcome: "refreshed",
        fields: expect.arrayContaining(["snapshotPhoto", "snapshotStructure"]),
      },
    ]);

    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("profile/u/photos/new.jpg");
    expect(after.snapshotStructure).toBe("Nouvelle structure");
  });

  it("ne touche pas une inscription approuvee ni une inscription rejetee", async () => {
    const user = await makeParticipant("b");
    const { eventId, categoryId } = await makeEvent("b");
    const approved = await makeRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "APPROVED",
    });
    const other = await makeEvent("b2");
    const rejected = await makeRegistration({
      userId: user.id,
      eventId: other.eventId,
      categoryId: other.categoryId,
      status: "REJECTED",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const a = await prisma.registration.findUniqueOrThrow({ where: { id: approved.id } });
    const r = await prisma.registration.findUniqueOrThrow({ where: { id: rejected.id } });
    expect(a.snapshotPhoto).toBe("uploads/legacy/old.jpg");
    expect(r.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("ignore une inscription en attente sur un evenement archive", async () => {
    const user = await makeParticipant("c");
    const { eventId, categoryId } = await makeEvent("c", { archived: true });
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("n'ecrit rien quand le snapshot est deja aligne", async () => {
    const user = await makeParticipant("d");
    const { eventId, categoryId } = await makeEvent("d");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await refreshPendingRegistrationSnapshots(user.id);
    const first = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const second = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("ne fait rien si le profil est incomplet", async () => {
    const user = await makeParticipant("e");
    const { eventId, categoryId } = await makeEvent("e");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    await prisma.user.update({ where: { id: user.id }, data: { photo: null } });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("retourne un tableau vide pour un utilisateur inconnu", async () => {
    expect(await refreshPendingRegistrationSnapshots("inconnu")).toEqual([]);
  });
});
```

Le test d'idempotence appelle la fonction deux fois : le premier appel aligne le snapshot (l'inscription part avec des valeurs volontairement différentes du profil), le second doit être un no-op — vérifié sur `updatedAt`, que Prisma met à jour à chaque écriture.

- [x] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-snapshot-sync.test.ts
```

Attendu : ÉCHEC à la résolution du module — `Cannot find module '@/lib/registration-snapshot-sync'`.

- [x] **Étape 3 : Implémenter le module**

Créer `src/lib/registration-snapshot-sync.ts` :

```ts
import { prisma } from "@/lib/prisma";
import {
  buildRegistrationSnapshot,
  isParticipantProfileComplete,
  type RegistrationSnapshot,
} from "@/lib/participant-profile";

// v4 (plan 15) : le gel des colonnes snapshot* ne vaut que pour les inscriptions
// validees. Tant qu'une inscription est en attente, elle suit le profil.
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

const SNAPSHOT_KEYS = [
  "snapshotFirstName",
  "snapshotLastName",
  "snapshotEmail",
  "snapshotStructure",
  "snapshotPhoto",
  "snapshotIdDocumentType",
  "snapshotIdDocumentNumber",
  "snapshotIdDocument",
] as const;

function changedFields(
  current: Record<string, unknown>,
  target: RegistrationSnapshot,
): string[] {
  return SNAPSHOT_KEYS.filter((k) => current[k] !== target[k]);
}

export async function refreshPendingRegistrationSnapshots(
  userId: string,
): Promise<SnapshotRefreshOutcome[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
    },
  });
  // Garde defensive : le schema de mise a jour du profil refuse les valeurs vides,
  // un profil complet ne peut donc pas le redevenir. On ne suppose rien pour autant.
  if (!user || !isParticipantProfileComplete(user)) return [];

  const target = buildRegistrationSnapshot(user);

  const registrations = await prisma.registration.findMany({
    where: { userId, status: "PENDING", event: { archived: false } },
    select: {
      id: true,
      eventId: true,
      event: { select: { orgId: true } },
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotEmail: true,
      snapshotStructure: true,
      snapshotPhoto: true,
      snapshotIdDocumentType: true,
      snapshotIdDocumentNumber: true,
      snapshotIdDocument: true,
    },
  });

  const outcomes: SnapshotRefreshOutcome[] = [];

  for (const registration of registrations) {
    const fields = changedFields(registration, target);
    if (fields.length === 0) continue;

    await prisma.registration.update({ where: { id: registration.id }, data: target });
    outcomes.push({
      registrationId: registration.id,
      eventId: registration.eventId,
      orgId: registration.event.orgId,
      outcome: "refreshed",
      fields,
    });
  }

  return outcomes;
}
```

- [x] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-snapshot-sync.test.ts
```

Attendu : SUCCÈS sur les six tests.

- [x] **Étape 5 : Vérifier lint et types**

```bash
make lint && make typecheck
```

Attendu : aucun warning, aucune erreur de type.

---

### Task 3 : Module de synchronisation — règle de blocage document

**Files:**
- Modify: `src/lib/registration-snapshot-sync.ts` (fonction `refreshPendingRegistrationSnapshots`)
- Test: `src/lib/__tests__/registration-snapshot-sync.test.ts`

**Interfaces:**
- Consomme : la fonction de la Task 2, inchangée dans sa signature.
- Produit : la variante `{ outcome: "skipped_document_blocked" }` du type `SnapshotRefreshOutcome`, exploitée par la Task 4.

Rappel du risque, qui justifie cette tâche : à la création d'une inscription, un `BlockedDocument` correspondant au numéro de pièce — au niveau plateforme (`eventId: null`) ou de l'événement — interdit l'inscription (`src/app/api/events/[slug]/register/route.ts:128-136`). Propager un nouveau numéro sans rejouer ce contrôle ferait entrer après coup un document que l'événement a explicitement bloqué.

- [x] **Étape 1 : Écrire les tests qui échouent**

Ajouter à `src/lib/__tests__/registration-snapshot-sync.test.ts`, dans le même `describe` :

```ts
  it("saute l'inscription dont l'evenement bloque le nouveau numero, et met a jour les autres", async () => {
    const user = await makeParticipant("f");
    const bloquant = await makeEvent("f-bloquant");
    const libre = await makeEvent("f-libre");
    const regBloquee = await makeRegistration({
      userId: user.id,
      eventId: bloquant.eventId,
      categoryId: bloquant.categoryId,
    });
    const regLibre = await makeRegistration({
      userId: user.id,
      eventId: libre.eventId,
      categoryId: libre.categoryId,
    });
    await prisma.blockedDocument.create({
      data: { eventId: bloquant.eventId, documentNumber: "NEW-1", reason: "Fraude" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { idDocumentNumber: "NEW-1", photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toContainEqual({
      registrationId: regBloquee.id,
      eventId: bloquant.eventId,
      orgId: bloquant.orgId,
      outcome: "skipped_document_blocked",
    });
    expect(outcomes).toContainEqual(
      expect.objectContaining({ registrationId: regLibre.id, outcome: "refreshed" }),
    );

    const bloquee = await prisma.registration.findUniqueOrThrow({ where: { id: regBloquee.id } });
    const passee = await prisma.registration.findUniqueOrThrow({ where: { id: regLibre.id } });
    expect(bloquee.snapshotIdDocumentNumber).toBe("OLD-1");
    expect(bloquee.snapshotPhoto).toBe("uploads/legacy/old.jpg");
    expect(passee.snapshotIdDocumentNumber).toBe("NEW-1");
  });

  it("saute l'inscription quand le blocage est au niveau plateforme", async () => {
    const user = await makeParticipant("g");
    const { orgId, eventId, categoryId } = await makeEvent("g");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    await prisma.blockedDocument.create({
      data: { eventId: null, documentNumber: "NEW-2", reason: "Blocage plateforme" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { idDocumentNumber: "NEW-2" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      { registrationId: reg.id, eventId, orgId, outcome: "skipped_document_blocked" },
    ]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotIdDocumentNumber).toBe("OLD-1");
  });

  it("ne consulte pas les blocages quand le numero de piece n'a pas change", async () => {
    const user = await makeParticipant("h");
    const { eventId, categoryId } = await makeEvent("h");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    // Un blocage existe sur le numero courant : il ne doit pas s'appliquer,
    // puisque la propagation ne change pas ce champ.
    await prisma.blockedDocument.create({
      data: { eventId, documentNumber: "OLD-1", reason: "Blocage historique" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      expect.objectContaining({ registrationId: reg.id, outcome: "refreshed" }),
    ]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("profile/u/photos/new.jpg");
  });
```

Le troisième test verrouille une décision de la spec : le contrôle ne se déclenche que si `snapshotIdDocumentNumber` change. Un blocage posé sur le numéro déjà présent dans l'inscription ne doit pas geler la propagation des autres champs — ce blocage-là relève de l'organisation, qui rejettera le dossier.

- [x] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-snapshot-sync.test.ts
```

Attendu : ÉCHEC sur les deux premiers nouveaux tests — la fonction renvoie `refreshed` là où on attend `skipped_document_blocked`. Le troisième passe déjà.

- [x] **Étape 3 : Implémenter la règle**

Dans `src/lib/registration-snapshot-sync.ts`, remplacer le corps de la boucle par :

```ts
  for (const registration of registrations) {
    const fields = changedFields(registration, target);
    if (fields.length === 0) continue;

    // Le controle de blocage n'est rejoue que si le numero change : un blocage
    // pose sur le numero deja present releve de la decision de l'organisation.
    if (fields.includes("snapshotIdDocumentNumber")) {
      const blocked = await prisma.blockedDocument.findFirst({
        where: {
          documentNumber: target.snapshotIdDocumentNumber,
          OR: [{ eventId: null }, { eventId: registration.eventId }],
        },
      });
      if (blocked) {
        outcomes.push({
          registrationId: registration.id,
          eventId: registration.eventId,
          orgId: registration.event.orgId,
          outcome: "skipped_document_blocked",
        });
        continue;
      }
    }

    await prisma.registration.update({ where: { id: registration.id }, data: target });
    outcomes.push({
      registrationId: registration.id,
      eventId: registration.eventId,
      orgId: registration.event.orgId,
      outcome: "refreshed",
      fields,
    });
  }
```

Le `OR` reprend la forme utilisée à l'inscription : le typage Prisma n'accepte pas `null` dans un `in` sur un champ nullable.

- [x] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-snapshot-sync.test.ts
```

Attendu : SUCCÈS sur les neuf tests.

- [x] **Étape 5 : Vérifier la couverture du module**

```bash
make test-coverage
```

Attendu : `src/lib/registration-snapshot-sync.ts` à 100 % en lignes, branches, fonctions et statements. Si une branche manque, ajouter le test correspondant — ne jamais ajouter d'exclusion pour atteindre le seuil.

---

### Task 4 : Branchement dans `PUT /api/account/profile` + audit

**Files:**
- Modify: `src/app/api/account/profile/route.ts:143-162`
- Test: `src/app/api/account/__tests__/profile.test.ts`

**Interfaces:**
- Consomme : `refreshPendingRegistrationSnapshots()` (Tasks 2-3) et la valeur `REGISTRATION_SNAPSHOT_REFRESHED` (Task 1).
- Produit : le comportement final visible du côté API ; rien n'en dépend en aval.

- [x] **Étape 1 : Écrire les tests qui échouent**

Ajouter à `src/app/api/account/__tests__/profile.test.ts` un `describe` dédié. Il réutilise `withSession`, `makeReq` et `COMPLETE_PROFILE` déjà définis dans le fichier :

```ts
describe("PUT /api/account/profile — propagation aux inscriptions en attente", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  async function seedPendingRegistration(scope: string) {
    const user = await prisma.user.create({
      data: {
        email: `sync-${scope}@profile.test`,
        password: "x",
        name: "P",
        ...COMPLETE_PROFILE,
      },
    });
    const org = await prisma.organization.create({
      data: { name: `Org ${scope}`, slug: `org-sync-${scope}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Event",
        slug: `event-sync-${scope}`,
        location: "L",
        date: new Date("2026-12-15"),
      },
    });
    const category = await prisma.category.create({
      data: { eventId: event.id, name: "Cat", color: "#123456", number: 1 },
    });
    const registration = await prisma.registration.create({
      data: {
        id: `reg-profile-${scope}`,
        userId: user.id,
        eventId: event.id,
        categoryId: category.id,
        status: "PENDING",
        snapshotFirstName: COMPLETE_PROFILE.firstName,
        snapshotLastName: COMPLETE_PROFILE.lastName,
        snapshotEmail: user.email,
        snapshotStructure: COMPLETE_PROFILE.structure,
        snapshotPhoto: COMPLETE_PROFILE.photo,
        snapshotIdDocumentType: COMPLETE_PROFILE.idDocumentType,
        snapshotIdDocumentNumber: COMPLETE_PROFILE.idDocumentNumber,
        snapshotIdDocument: COMPLETE_PROFILE.idDocument,
      },
    });
    return { user, org, event, registration };
  }

  it("repercute la nouvelle photo jusqu'au snapshot et journalise", async () => {
    const { user, org, event, registration } = await seedPendingRegistration("a");
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ photo: "profile/u/photos/new.jpg" }, "PUT"));

    expect(res.status).toBe(200);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(after.snapshotPhoto).toBe("profile/u/photos/new.jpg");

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED", targetId: registration.id },
    });
    expect(log).not.toBeNull();
    expect(log?.eventId).toBe(event.id);
    expect(log?.orgId).toBe(org.id);
    expect(log?.userId).toBe(user.id);
    expect(log?.details).toMatchObject({ outcome: "refreshed" });
  });

  it("ne journalise rien quand aucun champ de snapshot ne change", async () => {
    const { user } = await seedPendingRegistration("b");
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ photo: COMPLETE_PROFILE.photo }, "PUT"));

    expect(res.status).toBe(200);
    const count = await prisma.activityLog.count({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED" },
    });
    expect(count).toBe(0);
  });

  it("journalise le saut quand le nouveau numero de piece est bloque", async () => {
    const { user, event, registration } = await seedPendingRegistration("c");
    await prisma.blockedDocument.create({
      data: { eventId: event.id, documentNumber: "BLOQUE-9", reason: "Fraude" },
    });
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ idDocumentNumber: "BLOQUE-9" }, "PUT"));

    expect(res.status).toBe(200);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(after.snapshotIdDocumentNumber).toBe(COMPLETE_PROFILE.idDocumentNumber);

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED", targetId: registration.id },
    });
    expect(log.details).toMatchObject({ outcome: "skipped_document_blocked" });
  });
});
```

Le troisième test passe un numéro bloqué **au niveau de l'événement** : le blocage plateforme (`eventId: null`) est déjà refusé en amont par la route avec un 403 (`src/app/api/account/profile/route.ts:111-121`), il ne peut donc pas atteindre la propagation.

- [x] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/account/__tests__/profile.test.ts
```

Attendu : ÉCHEC — le snapshot reste sur l'ancienne photo et aucun `ActivityLog` n'est créé.

- [x] **Étape 3 : Implémenter le branchement**

Dans `src/app/api/account/profile/route.ts`, ajouter les imports :

```ts
import { refreshPendingRegistrationSnapshots } from "@/lib/registration-snapshot-sync";
```

puis, juste après l'appel `await submitProfile(session.id);` et avant le `return` :

```ts
    // v4 (plan 15) : les inscriptions encore en attente suivent le profil. Une
    // inscription validee reste figee. Pas de catch : masquer un echec ici ne se
    // verrait qu'a l'impression du badge, et l'operation est idempotente.
    const refreshed = await refreshPendingRegistrationSnapshots(session.id);
    for (const outcome of refreshed) {
      await logActivity({
        type: "REGISTRATION_SNAPSHOT_REFRESHED",
        userId: session.id,
        targetId: outcome.registrationId,
        eventId: outcome.eventId,
        orgId: outcome.orgId,
        details:
          outcome.outcome === "refreshed"
            ? { outcome: outcome.outcome, fields: outcome.fields }
            : { outcome: outcome.outcome },
        req,
      });
    }
```

- [x] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/account/__tests__/profile.test.ts
```

Attendu : SUCCÈS.

- [x] **Étape 5 : Écrire le test E2E de bout en bout**

Ajouter dans `e2e/public/account-profile.spec.ts`, à l'intérieur du `test.describe` existant. Il suit le test « upload photo persists » déjà présent, en y ajoutant une inscription en attente :

```ts
  test("la nouvelle photo se propage a l'inscription en attente", async ({ page }) => {
    const fixtures = ensureFixtures();
    const user = await createTestUser({
      scope: "profile-photo-propagation",
      verified: true,
      profile: true,
    });
    const { eventId, categoryId } = await createTestEvent({ scope: "photo-propagation" });
    const reg = await createTestRegistration({
      eventId,
      userId: user.id,
      categoryId,
      status: "PENDING",
    });
    const before = await getDb().registration.findUnique({
      where: { id: reg.id },
      select: { snapshotPhoto: true },
    });

    await loginAs(page, user);
    await page.goto("/account/profile");
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', fixtures.jpeg);
    await expect(page.getByText(/photo enregistrée/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await page.waitForTimeout(800);

    const after = await getDb().registration.findUnique({
      where: { id: reg.id },
      select: { snapshotPhoto: true },
    });
    expect(after?.snapshotPhoto).not.toBe(before?.snapshotPhoto);
    expect(after?.snapshotPhoto).toMatch(/^profile\/.+\/photos\/.+\.jpg$/);
  });
```

Compléter l'import du fichier avec `createTestEvent` et `createTestRegistration`, déjà exportés par `e2e/helpers/db.ts`.

- [x] **Étape 6 : Lancer le test E2E et vérifier qu'il passe**

```bash
make test-e2e
```

Attendu : SUCCÈS. Si l'exécution est lancée avant la Task 4, ce test échoue — c'est le comportement attendu d'un test écrit avant son implémentation.

- [x] **Étape 7 : Lancer la suite complète**

```bash
make lint && make typecheck && make test
```

Attendu : tout au vert. Cette étape vérifie qu'aucun test existant ne supposait qu'une modification de profil laisse les inscriptions intactes.

> La base de dev est vidée par `make test` : relancer `make db-seed` avant toute reprise manuelle de l'application.

---

### Task 5 : Détail d'inscription côté organisation — retrait de l'encart

**Files:**
- Modify: `src/components/event/RegistrationDetailPanel.tsx:112-124` (bloc `KeyValue`) et `:137-161` (carte « Pièces fournies »)
- Test: `e2e/event/registration-detail.spec.ts`

**Interfaces:**
- Consomme : le champ `idDocumentReadable` du type `Reg` (`RegistrationDetailPanel.tsx:30`), déjà calculé par la page (`src/app/event/[eventId]/registrations/[regId]/page.tsx:29-31`). Aucune signature ne change : la page continue de passer les mêmes props.
- Produit : rien dont dépend une autre tâche.

Le staff plateforme conserve l'aperçu réel de la pièce ; pour tout autre utilisateur, l'encart disparaît et le statut de vérification devient une ligne d'information.

- [x] **Étape 1 : Écrire le test E2E qui échoue**

Ajouter dans `e2e/event/registration-detail.spec.ts`, à l'intérieur du `test.describe` existant, en réutilisant son helper `seedReg` et `loginAndEnter` :

```ts
  test("un membre d'organisation ne voit pas d'encart de piece d'identite", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-piece-masquee");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);

    await expect(page.getByText("Pièce d'identité")).toHaveCount(0);
    await expect(page.getByText("Pièces fournies")).toHaveCount(0);
    await expect(page.getByText("Photo")).toBeVisible();
    await expect(
      page.getByText(/vérifiée par la plateforme|en attente de vérification|refusée par la plateforme/i),
    ).toBeVisible();
  });
```

`seedReg(scope)` retourne `{ orgId, eventId, categoryId, participant, reg, admin }` et crée un `admin` OWNER de l'organisation — donc non-staff : c'est exactement le cas à couvrir. La signature de `loginAndEnter` avec `{ kind: "event", id: eventId }` reprend celle des autres tests du fichier.

- [x] **Étape 2 : Lancer le test et vérifier qu'il échoue**

```bash
make test-e2e
```

Attendu : ÉCHEC — « Pièce d'identité » et « Pièces fournies » sont présents.

- [x] **Étape 3 : Implémenter**

Dans `src/components/event/RegistrationDetailPanel.tsx`, ajouter la ligne d'identité au `KeyValue` existant, après l'entrée « Pièce » :

```tsx
              { label: "Pièce", value: `${r.idDocumentType} ${r.idDocumentNumber}` },
              {
                label: "Identité",
                value:
                  r.profileStatus === "APPROVED"
                    ? r.profileReviewedAt
                      ? `Vérifiée par la plateforme le ${new Date(r.profileReviewedAt).toLocaleDateString("fr-FR")}`
                      : "Vérifiée par la plateforme"
                    : r.profileStatus === "REJECTED"
                      ? "Refusée par la plateforme"
                      : "En attente de vérification par la plateforme",
              },
```

puis remplacer la carte « Pièces fournies » par :

```tsx
      <Card>
        <CardHead title={r.idDocumentReadable ? "Pièces fournies" : "Photo"} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={r.photo} label="Photo" />
            {/* La piece d'identite n'est servie qu'au staff plateforme (cf. canRead()
                dans /api/files) : pour l'organisation, ne rien afficher plutot qu'un
                encart qui se lit comme un fichier consultable. */}
            {r.idDocumentReadable && (
              <DocumentPreview storageKey={r.idDocument} label="Pièce d'identité" readable />
            )}
          </div>
        </CardBody>
      </Card>
```

Retirer l'import devenu inutile de `FileBox` (`RegistrationDetailPanel.tsx:13`) — le linter le signalera sinon. Vérifier d'abord qu'il n'est pas utilisé ailleurs dans le fichier :

```bash
grep -n "FileBox" src/components/event/RegistrationDetailPanel.tsx
```

- [x] **Étape 4 : Lancer le test E2E et vérifier qu'il passe**

```bash
make test-e2e
```

Attendu : SUCCÈS, y compris les tests existants du même fichier.

- [x] **Étape 5 : Vérifier visuellement dans le navigateur — À LA CHARGE DE L'UTILISATEUR**

> **En session automatisée, ne pas cocher cette étape comme vérifiée.** Un agent headless ne peut pas juger un rendu ; le test E2E de l'étape 2 couvre l'essentiel. Cocher en consignant dans la table `## Progression` : « recette visuelle du détail d'inscription à faire par l'utilisateur ».

Sur `https://badge.local`, ouvrir le détail d'une inscription en tant que membre d'organisation : la carte ne montre que la photo, la ligne « Identité » porte le statut de vérification, aucun encart de pièce n'apparaît. Se reconnecter en staff plateforme et rouvrir la même page : l'aperçu de la pièce est bien là.

- [x] **Étape 6 : Vérifier lint et types**

```bash
make lint && make typecheck
```

Attendu : aucun warning (notamment aucun import inutilisé), aucune erreur de type.

---

### Task 6 : Documentation

**Files:**
- Modify: `docs/v4/architecture.md` (section sur les inscriptions et le DTO, autour de la ligne 90)
- Modify: `docs/v4/features/validation-profils.md` (sections « Cycle de vie du profil » et « Écrans »)

**Interfaces:**
- Consomme : le comportement livré par les Tasks 1 à 5.
- Produit : rien.

- [ ] **Étape 1 : Documenter la règle dans l'architecture**

Ajouter dans `docs/v4/architecture.md`, à la suite du paragraphe sur le DTO d'inscription :

```markdown
Les colonnes `snapshot*` d'une `Registration` sont **figées à l'approbation**, pas à la
création : tant qu'une inscription est en attente, une modification du profil participant
la réaligne (`src/lib/registration-snapshot-sync.ts`, appelé par
`PUT /api/account/profile`). Une inscription `APPROVED` ne change plus — le badge émis et
la vérification publique doivent refléter l'identité au moment de la décision. Une
inscription `REJECTED` passe par la resoumission, qui réécrit déjà le snapshot. Une
inscription dont l'événement bloque le nouveau numéro de pièce est laissée intacte, et
chaque inscription touchée produit un `REGISTRATION_SNAPSHOT_REFRESHED` au journal.
```

- [ ] **Étape 2 : Documenter le cycle de vie et l'écran**

Dans `docs/v4/features/validation-profils.md`, ajouter à la fin de la section « Cycle de vie du profil » :

```markdown
Toute modification du profil réaligne les inscriptions **en attente** du participant sur
les nouvelles valeurs ; les inscriptions déjà approuvées restent figées. C'est ce qui
permet à un participant de corriger une photo ou une pièce sans attendre un rejet.
```

et compléter la ligne « Organisation » de la section « Écrans » :

```markdown
- **Organisation** : détail d'inscription (photo, ligne « Identité » portant l'état de
  vérification plateforme, bouton Approuver désactivé si profil non validé, rejet via le
  catalogue). La pièce d'identité elle-même n'est jamais affichée à l'organisation.
```

- [ ] **Étape 3 : Relire l'ensemble**

Vérifier qu'aucune autre page de `docs/v4/` n'affirme que les snapshots sont figés dès la création :

```bash
grep -rn "snapshot" docs/v4/ | grep -iv "specs/\|plans/"
```

Corriger toute formulation devenue fausse.

- [ ] **Étape 4 : Vérification finale**

```bash
make lint && make typecheck && make test
```

Attendu : tout au vert. Mettre ensuite la table `## Progression` à jour, puis signaler que le travail est pret a etre relu. Le commit suit la regle des contraintes globales : rien en session interactive, un commit par tache sous `run-plans.sh`.

---

## Notes d'exécution

- Le fichier de test `src/lib/__tests__/registration-snapshot-sync.test.ts` est créé en Task 2 puis complété en Task 3 : ne pas le recréer.
- Les helpers `makeParticipant`, `makeEvent` et `makeRegistration` sont locaux à ce fichier de test ; le reset global de `src/test-setup.ts` les rend réutilisables d'un test à l'autre sans nettoyage manuel.
- `make db-push` (Task 1, étape 2) modifie la base de dev. C'est une opération de schéma non destructive ici — un ajout de valeur d'enum — mais elle reste à signaler à l'utilisateur avant exécution.
