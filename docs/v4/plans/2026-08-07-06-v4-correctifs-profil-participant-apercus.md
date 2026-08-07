# Correctifs profil participant & apercus de documents — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-07-06-v4-correctifs-profil-participant-apercus.md`](../specs/2026-08-07-06-v4-correctifs-profil-participant-apercus.md)

**Goal:** Corriger le transfert des informations du participant vers les ecrans staff (colonnes Nom et E-mail vides dans la liste des inscriptions) et afficher de vrais apercus de la photo et de la piece d'identite partout ou ils sont attendus.

**Architecture:** Le contrat de sortie des inscriptions est centralise dans un helper pur `toRegistrationListDTO()` (`src/lib/registration-dto.ts`) applique cote serveur, ce qui supprime la divergence entre les trois definitions actuelles (route liste non aplatie, route badges aplatie, export aplati). Un composant partage `DocumentPreview` (`src/components/ui/`) rend un fichier stocke via `/api/files/<key>` sous quatre etats (image, PDF, absent, non consultable) et remplace les liens bruts et les cles de stockage affichees en clair. Il sera reutilise par les plans 07 et 08.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript 5, Tailwind CSS 4, Prisma 6, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » de ce plan ne valent **pas** autorisation : elles decrivent le decoupage souhaite *si* un commit est demande.
2. **Aucune modification de `src/` pour faire passer un test.** Si un test revele un defaut applicatif, corriger le defaut ; ne jamais adapter le test.
3. **Seuils de couverture = gate a 100%** (lignes / branches / fonctions / statements) sur `src/lib/**` et `src/app/api/**`. Tout nouveau fichier dans ces dossiers doit etre integralement couvert, sinon `make test-coverage` et la CI echouent.
4. **Les composants React ne sont pas couverts par l'unitaire** (politique de tests, section 1) : `DocumentPreview` est valide par l'E2E, pas par Vitest.
5. **Base de tests partagee :** `make test` vide la base de dev. Relancer `make db-seed` avant toute verification manuelle dans le navigateur.
6. **Contrat E2E strict :** zero `page.request.*` dans une spec, parcours de connexion via `loginAndEnter`, URL asserte a chaque etape, chaque action assert son succes **et** son echec. Voir `e2e/README.md`.
7. **Langue :** UI, messages et documentation en francais accentue ; identifiants, types et noms de fichiers en anglais ASCII.
8. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, puis pour les changements UI une verification reelle dans le navigateur.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | DTO des inscriptions : helper `toRegistrationListDTO` + route liste + typage client | [x] | 2026-08-07 | Corrige la cause A de l'item 1 |
| 2 | Composant partage `DocumentPreview` | [ ] | | Brique reutilisee par les plans 07 et 08 |
| 3 | Apercus dans l'espace compte participant (profil + detail inscription) | [ ] | | Items 2 et 4 |
| 4 | Apercus et etat des pieces dans l'espace evenement | [ ] | | Corrige la cause B de l'item 1 |
| 5 | Couverture E2E + documentation | [ ] | | |

---

## Etat initial (constate le 2026-08-07)

Ces faits ont ete verifies dans le depot avant redaction. Les revalider si le plan est execute longtemps apres.

- `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (GET, l.38-50) selectionne `snapshotFirstName`, `snapshotLastName`, `snapshotEmail`, `snapshotStructure` et renvoie les lignes **telles quelles** dans `{ registrations, total, page, limit }`.
- `src/components/event/RegistrationTable.tsx:10-21` declare un type `Row` avec `firstName`, `lastName`, `email`, `structure` ; l.39 fait `setRows(json.registrations)` sans conversion. Les colonnes Nom (l.121) et E-mail (l.124) sont donc vides.
- `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts:31-32` et `.../registrations/export/route.ts:17-24` aplatissent **deja** correctement — a ne pas re-casser.
- `src/lib/storage.ts:61` : `accountProfileKey()` produit `profile/{userId}/photos/...` et `profile/{userId}/documents/...`.
- `src/app/api/files/[...path]/route.ts:22-40` : `profile/{userId}/documents/` est **sensible** — lisible par le proprietaire et le staff plateforme uniquement (`ctx.isStaff`). Un membre d'organisation recoit 403.
- `src/components/event/RegistrationDetailPanel.tsx:135-146` affiche deux `FileBox` cliquables vers `/api/files/...` : celui de la piece d'identite mene a un 403 pour un membre d'organisation.
- `src/app/account/profile/ProfileForm.tsx:140` et `:193` affichent la **cle de stockage brute** en sous-titre de `FileBox` (`subtitle={photo}` / `subtitle={idDocument}`).
- `src/app/account/registrations/[id]/page.tsx:33-48` ne selectionne **ni** `snapshotPhoto` **ni** `snapshotIdDocument`.
- Les tests d'integration de la route liste vivent dans `src/lib/__tests__/api-event-registrations.test.ts`.

---

## Task 1 : DTO des inscriptions

**Files:**
- Create: `src/lib/registration-dto.ts`
- Create: `src/lib/__tests__/registration-dto.test.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (GET, l.33-56)
- Modify: `src/components/event/RegistrationTable.tsx` (l.30-42)
- Modify: `src/lib/__tests__/api-event-registrations.test.ts` (ajout d'un test de contrat)

**Interfaces:**
- Consomme : rien.
- Produit : `toRegistrationListDTO(row: RegistrationListRow): RegistrationListDTO` et le type exporte `RegistrationListDTO`, consomme par la route liste et par `RegistrationTable`.

- [x] **Step 1 : Ecrire le test unitaire en echec**

Creer `src/lib/__tests__/registration-dto.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { toRegistrationListDTO } from "@/lib/registration-dto";

const row = {
  id: "REG-1",
  snapshotFirstName: "Alice",
  snapshotLastName: "Doe",
  snapshotEmail: "alice@test.local",
  snapshotStructure: "ACME",
  status: "PENDING" as const,
  badgePrinted: false,
  allAccessGranted: false,
  createdAt: new Date("2026-08-07T10:00:00.000Z"),
  category: { id: "cat-1", name: "Presse", color: "#112233", number: 3 },
};

describe("toRegistrationListDTO", () => {
  it("aplatit les champs snapshot en champs metier", () => {
    expect(toRegistrationListDTO(row)).toEqual({
      id: "REG-1",
      firstName: "Alice",
      lastName: "Doe",
      email: "alice@test.local",
      structure: "ACME",
      status: "PENDING",
      badgePrinted: false,
      allAccessGranted: false,
      createdAt: new Date("2026-08-07T10:00:00.000Z"),
      category: { id: "cat-1", name: "Presse", color: "#112233", number: 3 },
    });
  });

  it("n'expose aucune cle prefixee snapshot", () => {
    const dto = toRegistrationListDTO(row) as Record<string, unknown>;
    expect(Object.keys(dto).some((k) => k.startsWith("snapshot"))).toBe(false);
  });
});
```

- [x] **Step 2 : Lancer le test et verifier qu'il echoue**

Run : `make test-unit -- src/lib/__tests__/registration-dto.test.ts`
Attendu : FAIL — `Cannot find module '@/lib/registration-dto'`.

- [x] **Step 3 : Ecrire l'implementation minimale**

Creer `src/lib/registration-dto.ts` :

```ts
import type { RegistrationStatus } from "@prisma/client";

// Contrat de sortie unique des listes d'inscriptions. Le prefixe `snapshot` est un
// detail de persistance : il ne doit fuiter ni dans l'API ni dans les composants.
export type RegistrationListRow = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotStructure: string;
  status: RegistrationStatus;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
  category: { id: string; name: string; color: string; number: number };
};

export type RegistrationListDTO = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: RegistrationStatus;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
  category: { id: string; name: string; color: string; number: number };
};

export function toRegistrationListDTO(row: RegistrationListRow): RegistrationListDTO {
  return {
    id: row.id,
    firstName: row.snapshotFirstName,
    lastName: row.snapshotLastName,
    email: row.snapshotEmail,
    structure: row.snapshotStructure,
    status: row.status,
    badgePrinted: row.badgePrinted,
    allAccessGranted: row.allAccessGranted,
    createdAt: row.createdAt,
    category: row.category,
  };
}
```

- [x] **Step 4 : Lancer le test et verifier qu'il passe**

Run : `make test-unit -- src/lib/__tests__/registration-dto.test.ts`
Attendu : PASS (2 tests).

- [x] **Step 5 : Ecrire le test d'integration de contrat en echec**

Ajouter dans `src/lib/__tests__/api-event-registrations.test.ts`, dans le `describe` couvrant `GET /api/org/[orgId]/events/[eventId]/registrations` (reutiliser les helpers de seed deja presents dans le fichier) :

```ts
it("renvoie un DTO aplati, sans cle snapshot", async () => {
  // Reutiliser le seed du describe : org + event + categorie + 1 registration.
  const res = await GET(
    new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`),
    { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  const row = json.registrations[0];
  expect(row.firstName).toBe("Alice");
  expect(row.email).toBe(registrationEmail);
  expect(Object.keys(row).some((k) => k.startsWith("snapshot"))).toBe(false);
});
```

- [x] **Step 6 : Lancer le test et verifier qu'il echoue**

Run : `make test -- src/lib/__tests__/api-event-registrations.test.ts`
Attendu : FAIL — `row.firstName` vaut `undefined` et une cle `snapshotFirstName` est presente.

- [x] **Step 7 : Appliquer le DTO dans la route**

Dans `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts`, importer le helper et transformer le resultat avant la reponse :

```ts
import { toRegistrationListDTO } from "@/lib/registration-dto";

// …

  return NextResponse.json({
    registrations: registrations.map(toRegistrationListDTO),
    total,
    page,
    limit,
  });
```

Le `select` Prisma existant fournit deja exactement les champs attendus par `RegistrationListRow` — ne pas le modifier.

- [x] **Step 8 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- src/lib/__tests__/api-event-registrations.test.ts`
Attendu : PASS, y compris les tests preexistants du fichier (ils asserent des statuts et des totaux, pas la forme des cles ; si l'un d'eux lit `snapshotFirstName`, le mettre a jour vers `firstName` — c'est le contrat qui change, pas le comportement).

- [x] **Step 9 : Typer la reponse cote client**

Dans `src/components/event/RegistrationTable.tsx`, remplacer la declaration locale de `Row` et l'assignation non typee :

```ts
import type { RegistrationListDTO } from "@/lib/registration-dto";

type Row = Omit<RegistrationListDTO, "createdAt"> & { createdAt: string };

// … dans load() :
    const json = (await res.json()) as { registrations: Row[]; total: number };
    startTransition(() => {
      setRows(json.registrations);
      setTotal(json.total);
    });
```

`createdAt` est serialise en chaine par `NextResponse.json` : le `Omit` rend cette difference explicite au lieu de la laisser implicite.

- [x] **Step 10 : Auditer les autres consommateurs**

Verifier que les trois autres chemins restent corrects et n'ont pas de decalage equivalent :

```bash
grep -rn "json.registrations\|setRows(" src/components src/app --include="*.tsx" | grep -v __tests__
```

Attendu : `BadgeListTable.tsx` (endpoint `/badges`, deja aplati cote serveur), `RegistrationTable.tsx` (corrige), `BlockedDocumentsForm.tsx` / `BlockedEmailsForm.tsx` (autres ressources). Verifier aussi a la lecture que `export/route.ts` et `badges/[badgeId]/route.tsx` mappent bien chaque `snapshot*` vers son champ metier. Aucune correction attendue ici — si un decalage est trouve, le corriger dans cette task avec son test.

- [x] **Step 11 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert, couverture a 100% (`src/lib/registration-dto.ts` entierement couvert par les deux tests unitaires).

- [x] **Step 12 : Verification navigateur**

`make db-seed`, puis se connecter en membre d'organisation, ouvrir `/event/<id>/registrations` : les colonnes **Nom** et **E-mail** affichent des valeurs.

- [x] **Step 13 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/lib/registration-dto.ts src/lib/__tests__/registration-dto.test.ts \
  "src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts" \
  src/components/event/RegistrationTable.tsx \
  src/lib/__tests__/api-event-registrations.test.ts
git commit -m "fix(v4): aplatit le DTO des inscriptions et corrige la liste vide"
```

---

## Task 2 : Composant partage `DocumentPreview`

**Files:**
- Create: `src/components/ui/DocumentPreview.tsx`
- Modify: `src/app/styleguide/page.tsx` (ajout d'une section de demonstration)

**Interfaces:**
- Consomme : `FileBox` et `Icon` (`src/components/ui/`), la route `/api/files/<key>`.
- Produit : `<DocumentPreview storageKey label readable? />`, consomme par les Tasks 3 et 4 de ce plan et par le plan 08.

- [ ] **Step 1 : Creer le composant**

Creer `src/components/ui/DocumentPreview.tsx` :

```tsx
"use client";

import { useState } from "react";
import { FileBox } from "./FileBox";
import { Icon } from "./Icon";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// Le mime n'est pas persiste : le type est deduit de l'extension de la cle de
// stockage. L'upload contraint deja les types (JPEG/PNG/WebP/PDF).
function isImageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function DocumentPreview({
  storageKey,
  label,
  readable = true,
}: {
  storageKey: string | null;
  label: string;
  readable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!storageKey) {
    return <FileBox icon="file" title={label} subtitle="Non fournie" />;
  }

  if (!readable) {
    return (
      <FileBox
        icon="file"
        title={label}
        subtitle="Verifiee par la plateforme — non consultable ici"
      />
    );
  }

  const url = `/api/files/${storageKey}`;
  const image = isImageKey(storageKey);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <FileBox
          icon={image ? "user" : "file"}
          title={label}
          subtitle="Cliquer pour agrandir"
          thumbUrl={image ? url : undefined}
          action={<Icon name="external-link" size={16} />}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-xl bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{label}</span>
              <div className="flex items-center gap-3">
                <a href={url} target="_blank" rel="noreferrer" className="text-sm text-green-600 hover:underline">
                  Ouvrir dans un onglet
                </a>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label} className="max-h-[70vh] w-full object-contain" />
            ) : (
              <iframe src={url} title={label} className="h-[70vh] w-full rounded-lg border border-slate-200" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2 : Ajouter la demonstration au styleguide**

Dans `src/app/styleguide/page.tsx`, ajouter une section presentant les quatre etats (image, PDF, absent, non consultable) en suivant la structure des sections existantes du fichier. Utiliser des cles fictives (`"profile/demo/photos/demo.png"`, `"profile/demo/documents/demo.pdf"`, `null`).

- [ ] **Step 3 : Verifier lint et typage**

Run : `make lint && make typecheck`
Attendu : aucun warning. Le composant n'a pas de test unitaire (politique de tests : les composants React sont couverts par l'E2E, Task 5).

- [ ] **Step 4 : Verification navigateur**

Ouvrir `/styleguide` : les quatre etats s'affichent, la vignette image ouvre la visionneuse, le PDF ouvre l'iframe, la fermeture fonctionne au clic sur le fond et sur la croix.

- [ ] **Step 5 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/components/ui/DocumentPreview.tsx src/app/styleguide/page.tsx
git commit -m "feat(v4): composant DocumentPreview partage"
```

---

## Task 3 : Apercus dans l'espace compte participant

**Files:**
- Modify: `src/app/account/profile/ProfileForm.tsx` (l.133-150 photo, l.186-200 document)
- Modify: `src/app/account/registrations/[id]/page.tsx` (l.33-48 select, ajout d'un bloc)

**Interfaces:**
- Consomme : `DocumentPreview` (Task 2).
- Produit : rien pour les tasks suivantes.

- [ ] **Step 1 : Remplacer la cle brute par l'apercu dans le formulaire de profil**

Dans `src/app/account/profile/ProfileForm.tsx`, importer `DocumentPreview` et remplacer le bloc `FileBox` de la photo (celui dont le sous-titre est `subtitle={photo}`) par :

```tsx
{photo ? (
  <div className="mb-3 space-y-1">
    <DocumentPreview storageKey={photo} label="Photo enregistree" />
    {uploadingPhoto && <p className="text-xs text-slate-500">Envoi en cours…</p>}
  </div>
) : null}
```

Et le bloc `FileBox` du document (`subtitle={idDocument}`) par :

```tsx
{idDocument ? (
  <div className="mb-3 space-y-1">
    <DocumentPreview storageKey={idDocument} label="Piece d'identite enregistree" />
    {uploadingDoc && <p className="text-xs text-slate-500">Envoi en cours…</p>}
  </div>
) : null}
```

Les imports `FileBox` et `Tag` deviennent inutilisables s'ils ne servent plus ailleurs dans le fichier : les retirer pour ne pas laisser de warning lint.

- [ ] **Step 2 : Verifier lint et typage**

Run : `make lint && make typecheck`
Attendu : aucun warning, notamment aucun import inutilise.

- [ ] **Step 3 : Etendre le `select` du detail d'inscription**

Dans `src/app/account/registrations/[id]/page.tsx`, ajouter au `select` de `prisma.registration.findUnique` :

```ts
      snapshotPhoto: true,
      snapshotIdDocument: true,
```

- [ ] **Step 4 : Ajouter le bloc « Pieces fournies »**

Toujours dans le meme fichier, apres la `Card` « Informations enregistrees pour cette inscription », ajouter :

```tsx
      <Card>
        <CardHead title="Pièces fournies" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={registration.snapshotPhoto} label="Photo" />
            <DocumentPreview storageKey={registration.snapshotIdDocument} label="Pièce d'identité" />
          </div>
        </CardBody>
      </Card>
```

Importer `DocumentPreview` en tete de fichier. La page est un Server Component ; `DocumentPreview` est un Client Component (`"use client"`), l'import direct est donc valide.

- [ ] **Step 5 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert.

- [ ] **Step 6 : Verification navigateur**

`make db-seed`, se connecter en participant, ouvrir `/account/profile` (les deux apercus s'affichent, la visionneuse s'ouvre) puis `/account/registrations/<id>` (bloc « Pieces fournies » avec la photo visible). Le participant est proprietaire de ses fichiers : `/api/files/profile/<sonId>/documents/...` doit renvoyer 200.

- [ ] **Step 7 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app/account/profile/ProfileForm.tsx "src/app/account/registrations/[id]/page.tsx"
git commit -m "feat(v4): apercus photo et piece d'identite dans l'espace compte"
```

---

## Task 4 : Apercus et etat des pieces dans l'espace evenement

**Files:**
- Modify: `src/app/event/[eventId]/registrations/[regId]/page.tsx` (l.22-40)
- Modify: `src/components/event/RegistrationDetailPanel.tsx` (l.16-33 type, l.128-149 bloc « Pieces fournies »)

**Interfaces:**
- Consomme : `DocumentPreview` (Task 2), `loadUserContext` (`src/lib/user-context.ts`).
- Produit : rien pour les tasks suivantes. Le plan 08 remplacera l'etat « non consultable » par l'etat de verification plateforme.

- [ ] **Step 1 : Calculer la lisibilite de la piece cote serveur**

Dans `src/app/event/[eventId]/registrations/[regId]/page.tsx`, determiner si le visiteur peut lire un document de profil — meme regle que `src/app/api/files/[...path]/route.ts` : seul le staff plateforme le peut.

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";

// … dans le composant, apres la lecture de la registration :
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const idDocumentReadable = Boolean(ctx?.isStaff);
```

Puis passer la valeur au panneau :

```tsx
    idDocumentReadable,
```

dans l'objet `r`, et `idDocumentReadable: boolean;` dans le type `Reg` du panneau.

- [ ] **Step 2 : Remplacer le bloc « Pieces fournies »**

Dans `src/components/event/RegistrationDetailPanel.tsx`, remplacer les deux `<a>` + `FileBox` par :

```tsx
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocumentPreview storageKey={r.photo} label="Photo" />
            <DocumentPreview
              storageKey={r.idDocument}
              label="Pièce d'identité"
              readable={r.idDocumentReadable}
            />
          </div>
```

Importer `DocumentPreview` ; retirer les imports `FileBox` et `Icon` s'ils ne servent plus dans le fichier (`Icon` est utilise ailleurs dans le panneau — verifier avant de retirer).

Les informations textuelles de la piece (type et numero) restent affichees dans le `KeyValue` existant : leur suppression n'est pas dans le perimetre.

- [ ] **Step 3 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert.

- [ ] **Step 4 : Verification navigateur — membre d'organisation**

`make db-seed`, se connecter en OWNER d'organisation, ouvrir le detail d'une inscription : la **photo** s'affiche en apercu, la **piece d'identite** affiche « Verifiee par la plateforme — non consultable ici » et n'est plus cliquable. Aucun 403 ne doit apparaitre dans l'onglet reseau.

- [ ] **Step 5 : Verification navigateur — staff plateforme**

Se connecter en `SUPER_ADMIN`, ouvrir la meme page : la piece d'identite est consultable et la visionneuse s'ouvre.

- [ ] **Step 6 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add "src/app/event/[eventId]/registrations/[regId]/page.tsx" src/components/event/RegistrationDetailPanel.tsx
git commit -m "fix(v4): apercu photo et etat explicite de la piece cote evenement"
```

---

## Task 5 : Couverture E2E et documentation

**Files:**
- Modify: `e2e/event/registrations.spec.ts`
- Modify: `e2e/public/account-profile.spec.ts`
- Modify: `e2e/public/account-registration.spec.ts`
- Modify: `docs/v4/README.md`
- Modify: `docs/v4/architecture.md`

**Interfaces:**
- Consomme : helpers `e2e/helpers/nav.ts` (`loginAndEnter`), `e2e/helpers/db.ts` (`createTestRegistration`, `makeEventAdminUser`, `createTestUser`).
- Produit : rien.

- [ ] **Step 1 : Spec E2E — la liste des inscriptions affiche nom et e-mail**

Ajouter dans `e2e/event/registrations.spec.ts`, section « Acces & rendu » :

```ts
test("la liste affiche le nom et l'e-mail du participant", async ({ page }) => {
  const { user, event } = await makeEventAdminUser({ prefix: "reglist-dto" });
  const registration = await createTestRegistration({
    eventId: event.id,
    firstName: "Alice",
    lastName: "Doe",
    email: "alice.dto@e2e.test",
  });

  await loginAndEnter(page, user, { workspace: "event", eventId: event.id });
  await page.getByRole("link", { name: "Inscriptions" }).click();
  await expect(page).toHaveURL(new RegExp(`/event/${event.id}/registrations$`));

  const row = page.getByRole("row", { name: /Alice Doe/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("alice.dto@e2e.test");
  expect(registration.id).toBeTruthy();
});
```

Adapter les noms d'arguments aux signatures reelles de `createTestRegistration` et `makeEventAdminUser` (`e2e/helpers/db.ts`) avant execution.

- [ ] **Step 2 : Lancer la spec et verifier qu'elle passe**

Run : `make test-e2e -- e2e/event/registrations.spec.ts`
Attendu : PASS. Si elle echoue, c'est que la Task 1 est incomplete — corriger le code, jamais le test.

- [ ] **Step 3 : Spec E2E — apercus dans l'espace compte**

Dans `e2e/public/account-profile.spec.ts`, ajouter un test qui, apres connexion d'un participant au profil complet, verifie que la cle de stockage brute **n'est plus** affichee et que l'apercu l'est :

```ts
test("le profil affiche les apercus et non les cles de stockage", async ({ page }) => {
  const user = await createTestUser({ prefix: "profile-preview", completeProfile: true });

  await loginAndEnter(page, user, { workspace: "account" });
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/\/account\/profile$/);

  await expect(page.getByText("Photo enregistree")).toBeVisible();
  await expect(page.getByText("Piece d'identite enregistree")).toBeVisible();
  await expect(page.getByText(/^profile\//)).toHaveCount(0);
});
```

Dans `e2e/public/account-registration.spec.ts`, ajouter un test verifiant la presence du bloc « Pieces fournies » sur `/account/registrations/<id>`.

- [ ] **Step 4 : Lancer les specs et verifier qu'elles passent**

Run : `make test-e2e -- e2e/public/account-profile.spec.ts e2e/public/account-registration.spec.ts`
Attendu : PASS.

- [ ] **Step 5 : Mettre a jour la documentation**

Dans `docs/v4/README.md` : ajouter l'entree de plan dans la liste des documents et une ligne « Correctifs profil participant & apercus | Livre » dans le tableau d'etat d'avancement.

Dans `docs/v4/architecture.md` : documenter le contrat de DTO des inscriptions (les routes de liste renvoient des champs metier aplatis, jamais de cle `snapshot*`) et rappeler que les documents de profil ne sont lisibles que par leur proprietaire et le staff plateforme.

- [ ] **Step 6 : Verification finale**

Run : `make lint && make typecheck && make test && make test-e2e`
Attendu : tout vert. Comparer le nombre d'echecs E2E a la baseline connue (la suite a des echecs pre-existants lies a l'environnement mail et aux courses sur la base partagee) : aucun **nouvel** echec ne doit apparaitre.

- [ ] **Step 7 : Mettre a jour le tracker**

Passer les cinq lignes du tableau `## Progression` a `[x]` avec la date du jour.

- [ ] **Step 8 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add e2e/ docs/v4/README.md docs/v4/architecture.md docs/v4/plans/2026-08-07-06-v4-correctifs-profil-participant-apercus.md
git commit -m "test(v4): couverture e2e des apercus et du DTO des inscriptions"
```
