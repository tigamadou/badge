# Affichage des details d'un evenement — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-07-07-v4-affichage-details-evenement.md`](../specs/2026-08-07-07-v4-affichage-details-evenement.md)

**Goal:** Donner a un evenement un contenu descriptif et une periode, puis presenter ses informations de facon coherente sur les trois vues ou il apparait : page publique, tableau de bord de l'espace evenement, liste des evenements de l'organisation.

**Architecture:** Deux champs optionnels sont ajoutes au modele `Event` (`description`, `endDate`), sans aucun impact sur la logique metier existante — `date` reste la date de reference pour l'ID metier, les badges et l'ouverture des inscriptions. Un helper pur `formatEventPeriod()` (`src/lib/format-date.ts`) produit le libelle de periode, et un composant `EventInfoCard` (`src/components/event/`) rend le bloc d'informations en deux variantes (`public`, `staff`) consommees par la page publique et le dashboard.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma 6 / MySQL 8, Zod, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » ne valent pas autorisation.
2. **Aucune migration de donnees.** L'application n'est pas en production : `make db-push` suffit, suivi de `make db-seed`. Ne jamais lancer `make db-reset` sans demander.
3. **`endDate` est purement informatif.** Aucune logique metier ne doit s'y adosser : ni `generate-id.ts`, ni les badges, ni l'ouverture/cloture des inscriptions, ni l'archivage.
4. **Seuils de couverture = gate a 100%** sur `src/lib/**` et `src/app/api/**`.
5. **Base de tests partagee :** `make test` vide la base de dev ; relancer `make db-seed` avant toute verification navigateur.
6. **Contrat E2E strict :** zero `page.request.*`, connexion via `loginAndEnter`, URL assertee a chaque etape, succes **et** echec asseres. Voir `e2e/README.md`.
7. **Langue :** UI, emails et documentation en francais accentue ; code et identifiants en anglais ASCII.
8. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, plus verification navigateur pour les changements UI.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schema Prisma (`description`, `endDate`) + validation API + seed | [x] | 2026-08-07 | Validation endDate>=date create+patch, seed demo enrichi |
| 2 | Helper `formatEventPeriod` + composant `EventInfoCard` | [ ] | | |
| 3 | Integration des trois vues + formulaires + emails | [ ] | | |
| 4 | Couverture E2E + documentation | [ ] | | |

---

## Etat initial (constate le 2026-08-07)

- `prisma/schema.prisma` l.142-167 : `Event` porte `title`, `slug`, `location`, `date`, `logo`, `registrationOpen`, `badgeTemplateId`, `archived`. **Ni description, ni date de fin.**
- `src/lib/format-date.ts` expose `formatEventDate(date)` (format « 15 Décembre . 2026 ») et `isoDay(d)`. Teste dans `src/lib/__tests__/format-date.test.ts`.
- `src/components/public/PublicEventLayout.tsx:44` affiche `formatEventDate(event.date)` et le lieu dans la banniere ; `src/app/e/[slug]/page.tsx` n'ajoute qu'un bloc « Inscription en ligne » et la liste des categories.
- `src/app/event/[eventId]/page.tsx:30-39` ne selectionne que `id`, `orgId`, `title`, `slug`, `registrationOpen` : **ni date ni lieu ne sont affiches** au staff qui gere l'evenement.
- `src/app/org/[orgId]/events/page.tsx` affiche titre, date, lieu en colonnes ; le statut d'ouverture des inscriptions n'y figure pas.
- Creation : `POST /api/org/[orgId]/events` (`createSchema`, l.36-49) accepte `title`, `location`, `date`, `logo`, `slug`, `templateIds`, `manualCategories`.
- Edition : `PATCH /api/org/[orgId]/events/[eventId]` (l.31-34) accepte `title`, `location`, `date`, et applique les champs un a un (l.51-54).
- Formulaire d'edition : `src/components/event/EventSettingsForm.tsx` (champs l.98-100, payload l.67).
- Emails : `src/lib/mail.ts:285` utilise `formatFrenchDate(reg.event.date)` importe de `src/lib/mail-helpers.ts`.
- `loadPublicEventBySlug` (`src/lib/public-event.ts:22`) renvoie l'entite `Event` complete : les nouveaux champs y seront disponibles sans modification.

---

## Task 1 : Schema, validation et seed

**Files:**
- Modify: `prisma/schema.prisma` (model `Event`, l.142-167)
- Modify: `src/app/api/org/[orgId]/events/route.ts` (`createSchema` et `prisma.event.create`)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/route.ts` (`updateSchema` et construction de `data`)
- Modify: `prisma/seed.ts`
- Modify: `src/lib/__tests__/api-org.test.ts` (creation d'evenement) et `src/lib/__tests__/event-journey.test.ts` ou le fichier couvrant le PATCH evenement — verifier par `grep -rln "PATCH.*events/\[eventId\]\|updateSchema" src/lib/__tests__/`

**Interfaces:**
- Consomme : rien.
- Produit : les champs `Event.description: string | null` et `Event.endDate: Date | null`, consommes par les Tasks 2 et 3.

- [x] **Step 1 : Ecrire le test d'integration en echec (creation)**

Dans le fichier de tests couvrant `POST /api/org/[orgId]/events`, ajouter :

```ts
it("accepte une description et une date de fin", async () => {
  const res = await POST(
    new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Salon 2026",
        location: "Niamey",
        date: "2026-12-15",
        endDate: "2026-12-17",
        description: "Trois jours de conferences.",
      }),
    }),
    { params: Promise.resolve({ orgId: org.id }) },
  );
  expect(res.status).toBe(201);
  const { event } = await res.json();
  const stored = await prisma.event.findUnique({ where: { id: event.id } });
  expect(stored?.description).toBe("Trois jours de conferences.");
  expect(stored?.endDate?.toISOString().slice(0, 10)).toBe("2026-12-17");
});

it("refuse une date de fin anterieure a la date de debut", async () => {
  const res = await POST(
    new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Salon 2026",
        location: "Niamey",
        date: "2026-12-15",
        endDate: "2026-12-14",
      }),
    }),
    { params: Promise.resolve({ orgId: org.id }) },
  );
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("VALIDATION");
});
```

Adapter le nom de la variable d'organisation et la forme de l'appel au style deja en place dans le fichier.

- [x] **Step 2 : Lancer le test et verifier qu'il echoue**

Run : `make test -- src/lib/__tests__/api-org.test.ts`
Attendu : FAIL — `stored?.description` vaut `undefined` (le champ n'existe pas) ; le second test echoue avec un 201 au lieu d'un 400.

- [x] **Step 3 : Ajouter les champs au schema**

Dans `prisma/schema.prisma`, model `Event`, apres `date` :

```prisma
  // v4 (plan 07) : informatif uniquement. `date` reste la date de reference pour
  // l'ID metier, les badges et l'ouverture des inscriptions.
  endDate          DateTime?
  description      String?   @db.Text
```

- [x] **Step 4 : Pousser le schema**

Run : `make db-push`
Attendu : `The database is now in sync with your Prisma schema.` et regeneration du client Prisma.

- [x] **Step 5 : Etendre la validation de creation**

Dans `src/app/api/org/[orgId]/events/route.ts`, ajouter au `createSchema` :

```ts
  endDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid endDate" })
    .nullable()
    .optional(),
  description: z.string().max(5000).nullable().optional(),
```

puis, apres le `safeParse`, refuser une periode incoherente :

```ts
  if (parsed.data.endDate && new Date(parsed.data.endDate) < new Date(parsed.data.date)) {
    return NextResponse.json(
      { error: "VALIDATION", issues: [{ path: ["endDate"], message: "endDate < date" }] },
      { status: 400 },
    );
  }
```

et transmettre les deux champs a `prisma.event.create` :

```ts
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      description: parsed.data.description ?? null,
```

- [x] **Step 6 : Lancer les tests de creation et verifier qu'ils passent**

Run : `make test -- src/lib/__tests__/api-org.test.ts`
Attendu : PASS.

- [x] **Step 7 : Ecrire le test d'integration en echec (edition)**

Dans le fichier couvrant `PATCH /api/org/[orgId]/events/[eventId]`, ajouter :

```ts
it("met a jour la description et la date de fin", async () => {
  const res = await PATCH(
    new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "Nouvelle description.", endDate: "2026-12-18" }),
    }),
    { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
  );
  expect(res.status).toBe(200);
  const stored = await prisma.event.findUnique({ where: { id: event.id } });
  expect(stored?.description).toBe("Nouvelle description.");
});

it("refuse une date de fin anterieure a la date de l'evenement", async () => {
  const res = await PATCH(
    new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ endDate: "2020-01-01" }),
    }),
    { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
  );
  expect(res.status).toBe(400);
});
```

- [x] **Step 8 : Lancer le test et verifier qu'il echoue**

Run : `make test -- <fichier de tests du PATCH>`
Attendu : FAIL.

- [x] **Step 9 : Etendre la validation d'edition**

Dans `src/app/api/org/[orgId]/events/[eventId]/route.ts`, ajouter au schema de mise a jour les memes champs (`endDate`, `description`, tous deux `nullable().optional()`), puis dans la construction de `data` :

```ts
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.endDate !== undefined) {
    data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  }
```

La comparaison doit se faire contre la date **effective** apres patch : si `date` n'est pas dans le corps, lire la valeur en base.

```ts
  const effectiveDate = parsed.data.date ? new Date(parsed.data.date) : existing.date;
  if (parsed.data.endDate && new Date(parsed.data.endDate) < effectiveDate) {
    return NextResponse.json(
      { error: "VALIDATION", issues: [{ path: ["endDate"], message: "endDate < date" }] },
      { status: 400 },
    );
  }
```

`existing` est l'evenement deja charge par la route pour son controle d'appartenance ; si la route ne le charge pas encore, ajouter un `findUnique` avant la validation.

- [x] **Step 10 : Lancer les tests et verifier qu'ils passent**

Run : `make test -- <fichier de tests du PATCH>`
Attendu : PASS.

- [x] **Step 11 : Enrichir le seed**

Dans `prisma/seed.ts`, ajouter a au moins un evenement de demonstration une `description` de deux phrases et une `endDate` a J+2, et laisser au moins un autre evenement sans ces champs (pour exercer l'affichage mono-journee sans description).

- [x] **Step 12 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert, couverture a 100% (les deux nouvelles branches de validation sont couvertes par les tests d'echec ecrits aux Steps 1 et 7).

- [x] **Step 13 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add prisma/schema.prisma prisma/seed.ts "src/app/api/org/[orgId]/events/route.ts" \
  "src/app/api/org/[orgId]/events/[eventId]/route.ts" src/lib/__tests__/
git commit -m "feat(v4): champs description et date de fin sur les evenements"
```

---

## Task 2 : Helper de periode et composant `EventInfoCard`

**Files:**
- Modify: `src/lib/format-date.ts`
- Modify: `src/lib/__tests__/format-date.test.ts`
- Create: `src/components/event/EventInfoCard.tsx`

**Interfaces:**
- Consomme : `Event.date` / `Event.endDate` (Task 1), `Card` / `CardHead` / `CardBody` (`src/components/ui/Card`), `CatPill` (`src/components/ui/Labels`), `Icon`.
- Produit : `formatEventPeriod(date, endDate)` et `<EventInfoCard event categories variant />`, consommes par la Task 3.

- [ ] **Step 1 : Ecrire le test unitaire en echec**

Ajouter dans `src/lib/__tests__/format-date.test.ts` :

```ts
import { formatEventPeriod } from "@/lib/format-date";

describe("formatEventPeriod", () => {
  it("renvoie la date seule quand il n'y a pas de date de fin", () => {
    expect(formatEventPeriod("2026-12-15", null)).toBe("15 Décembre . 2026");
  });

  it("renvoie la date seule quand la date de fin est le meme jour", () => {
    expect(formatEventPeriod("2026-12-15", "2026-12-15")).toBe("15 Décembre . 2026");
  });

  it("renvoie une plage quand la date de fin est posterieure", () => {
    expect(formatEventPeriod("2026-12-15", "2026-12-17")).toBe(
      "Du 15 Décembre . 2026 au 17 Décembre . 2026",
    );
  });
});
```

- [ ] **Step 2 : Lancer le test et verifier qu'il echoue**

Run : `make test-unit -- src/lib/__tests__/format-date.test.ts`
Attendu : FAIL — `formatEventPeriod` n'est pas exporte.

- [ ] **Step 3 : Implementer le helper**

Ajouter dans `src/lib/format-date.ts` :

```ts
// v4 (plan 07) : libelle de periode. `endDate` est optionnelle et informative ;
// une fin le meme jour est traitee comme une absence de fin.
export function formatEventPeriod(
  date: string | Date,
  endDate: string | Date | null,
): string {
  const start = formatEventDate(date);
  if (!endDate) return start;
  const end = formatEventDate(endDate);
  if (end === start) return start;
  return `Du ${start} au ${end}`;
}
```

- [ ] **Step 4 : Lancer le test et verifier qu'il passe**

Run : `make test-unit -- src/lib/__tests__/format-date.test.ts`
Attendu : PASS (3 nouveaux tests), couverture du fichier a 100%.

- [ ] **Step 5 : Creer le composant `EventInfoCard`**

Creer `src/components/event/EventInfoCard.tsx` :

```tsx
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { CatPill, Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { formatEventPeriod } from "@/lib/format-date";

type EventInfo = {
  title: string;
  date: Date | string;
  endDate: Date | string | null;
  location: string;
  description: string | null;
  registrationOpen: boolean;
};

type CategoryInfo = { id: string; name: string; color: string };

export function EventInfoCard({
  event,
  categories,
  variant,
}: {
  event: EventInfo;
  categories: CategoryInfo[];
  variant: "public" | "staff";
}) {
  return (
    <Card>
      <CardHead
        title="Informations de l'événement"
        action={
          variant === "staff" ? (
            <Tag icon={event.registrationOpen ? "check" : "x"}>
              {event.registrationOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"}
            </Tag>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <Icon name="clock" size={15} />
            {formatEventPeriod(event.date, event.endDate)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <Icon name="map-pin" size={15} />
              {event.location}
            </span>
          )}
        </div>

        {event.description && (
          <p className="whitespace-pre-line text-sm text-slate-700">{event.description}</p>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <CatPill key={c.id} color={c.color} label={c.name} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
```

`whitespace-pre-line` preserve les sauts de ligne de la description sans autoriser de HTML : la description est du texte brut, echappe par React.

- [ ] **Step 6 : Verifier le nom des icones**

Run : `grep -n "map-pin\|\"clock\"" src/components/ui/Icon.tsx`
Attendu : les deux noms existent dans `IconName`. Si `map-pin` n'existe pas, utiliser une icone deja disponible plutot que d'en ajouter une (hors perimetre).

- [ ] **Step 7 : Verifier lint et typage**

Run : `make lint && make typecheck`
Attendu : aucun warning.

- [ ] **Step 8 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/lib/format-date.ts src/lib/__tests__/format-date.test.ts src/components/event/EventInfoCard.tsx
git commit -m "feat(v4): helper de periode et carte d'informations evenement"
```

---

## Task 3 : Integration des trois vues, formulaires et emails

**Files:**
- Modify: `src/app/e/[slug]/page.tsx`
- Modify: `src/components/public/PublicEventLayout.tsx` (l.7 type, l.44 affichage)
- Modify: `src/app/event/[eventId]/page.tsx` (l.30-39 select, insertion du bloc)
- Modify: `src/app/org/[orgId]/events/page.tsx`
- Modify: `src/components/event/EventSettingsForm.tsx`
- Modify: `src/app/org/[orgId]/events/new/page.tsx` et son formulaire client
- Modify: `src/lib/mail.ts` (l.285)

**Interfaces:**
- Consomme : `formatEventPeriod`, `EventInfoCard` (Task 2), champs `description` / `endDate` (Task 1).
- Produit : rien pour les tasks suivantes.

- [ ] **Step 1 : Page publique**

Dans `src/app/e/[slug]/page.tsx`, inserer avant la `Card` « Inscription en ligne » :

```tsx
<EventInfoCard
  event={{
    title: event.title,
    date: event.date,
    endDate: event.endDate,
    location: event.location,
    description: event.description,
    registrationOpen: event.registrationOpen,
  }}
  categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
  variant="public"
/>
```

`loadPublicEventBySlug` renvoie l'entite `Event` complete : les nouveaux champs sont disponibles sans changer la requete.

- [ ] **Step 2 : Banniere publique**

Dans `src/components/public/PublicEventLayout.tsx`, ajouter `endDate?: Date | string | null` au type `event` du `Props` et remplacer l'affichage l.44 :

```tsx
              <span>{formatEventPeriod(event.date as Date, event.endDate ?? null)}</span>
```

Remplacer l'import `formatEventDate` par `formatEventPeriod`. Verifier les autres appelants de `PublicEventLayout` (`grep -rn "PublicEventLayout" src/app`) : le champ etant optionnel, aucun n'a besoin d'etre modifie.

- [ ] **Step 3 : Tableau de bord de l'espace evenement**

Dans `src/app/event/[eventId]/page.tsx`, etendre le `select` :

```ts
      date: true,
      endDate: true,
      location: true,
      description: true,
```

charger les categories de l'evenement :

```ts
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
    select: { id: true, name: true, color: true },
  });
```

et inserer `<EventInfoCard event={event} categories={categories} variant="staff" />` juste apres le titre de page, avant l'alerte de quota. Le tableau de bord **operateur** (branche `role === "OPERATOR"`, l.44-62) reste inchange.

- [ ] **Step 4 : Liste des evenements de l'organisation**

Dans `src/app/org/[orgId]/events/page.tsx` : ajouter `endDate: true` au `select`, remplacer l'affichage de la date par `formatEventPeriod(e.date, e.endDate)` dans la colonne correspondante, et ajouter une pastille d'ouverture des inscriptions (`Tag`) dans la colonne de statut existante.

- [ ] **Step 5 : Formulaire d'edition**

Dans `src/components/event/EventSettingsForm.tsx` :
- etendre le type `initial.event` avec `endDate: string | null` et `description: string | null` ;
- ajouter les etats `const [endDate, setEndDate] = useState(initial.event.endDate?.slice(0, 10) ?? "")` et `const [description, setDescription] = useState(initial.event.description ?? "")` ;
- ajouter un `<Input label="Date de fin (optionnelle)" type="date" …>` a cote du champ Date, et un `<textarea>` « Description » sous les champs d'identite, stylise comme les autres champs (`rounded-lg border border-slate-300 px-3 py-2 text-sm`) ;
- inclure `endDate: endDate || null` et `description: description || null` dans le corps de la requete l.67 ;
- afficher le message d'erreur renvoye par l'API lorsque la validation echoue (le formulaire gere deja un etat d'erreur — le reutiliser).

Mettre a jour l'appelant (`src/app/event/[eventId]/settings/page.tsx`) pour transmettre les deux nouveaux champs.

- [ ] **Step 6 : Formulaire de creation**

Dans le formulaire de creation d'evenement (`src/app/org/[orgId]/events/new/`), ajouter les memes deux champs et les transmettre au `POST`.

- [ ] **Step 7 : Emails**

Dans `src/lib/mail.ts`, remplacer l.285 :

```ts
  const eventDate = formatEventPeriod(reg.event.date, reg.event.endDate);
```

en important `formatEventPeriod` depuis `@/lib/format-date`. Verifier que la requete Prisma alimentant `reg` selectionne bien `endDate` (ajouter le champ au `select` de l'evenement si necessaire) et appliquer le meme traitement aux autres gabarits qui affichent la date de l'evenement — les reperer par `grep -n "event.date" src/lib/mail.ts`.

- [ ] **Step 8 : Mettre a jour les tests de mail impactes**

Run : `make test -- src/lib/__tests__/mail.test.ts`
Attendu : les assertions portant sur la date de l'evenement passent toujours (evenements de test sans `endDate` : le libelle est inchange). Si une assertion echoue, c'est un changement de libelle non voulu — corriger le code.

- [ ] **Step 9 : Verification complete**

Run : `make lint && make typecheck && make test`
Attendu : tout vert.

- [ ] **Step 10 : Verification navigateur**

`make db-seed`, puis :
- `/e/<slug>` : banniere avec la periode, carte d'informations avec description et categories ;
- `/event/<id>` : carte d'informations en tete, date, lieu, statut des inscriptions ;
- `/org/<id>/events` : periode et pastille d'ouverture ;
- creation d'un evenement avec description et date de fin, puis edition ; verifier qu'une date de fin anterieure affiche un message d'erreur dans le formulaire.

- [ ] **Step 11 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add src/app src/components src/lib/mail.ts
git commit -m "feat(v4): affichage unifie des details d'un evenement"
```

---

## Task 4 : Couverture E2E et documentation

**Files:**
- Modify: `e2e/public/event-register.spec.ts` (spec de la page publique `/e/[slug]` et de son formulaire)
- Modify: `e2e/event/dashboard.spec.ts`
- Modify: `e2e/event/settings.spec.ts`
- Modify: `e2e/org/events.spec.ts`
- Modify: `e2e/helpers/db.ts` (`createTestEvent` : accepter `endDate` et `description`)
- Modify: `docs/v4/README.md`, `docs/v4/architecture.md`, `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md`

**Interfaces:**
- Consomme : `createTestEvent`, `makeEventAdminUser`, `loginAndEnter`.
- Produit : rien.

- [ ] **Step 1 : Etendre le helper de seed E2E**

Dans `e2e/helpers/db.ts`, ajouter a `createTestEvent` deux options facultatives `endDate?: Date` et `description?: string`, transmises a `prisma.event.create`. Ne pas changer la signature existante autrement : tous les appelants actuels doivent continuer a fonctionner.

- [ ] **Step 2 : Spec E2E — page publique**

```ts
test("la page publique affiche la periode, le lieu et la description", async ({ page }) => {
  const { event } = await createTestEvent({
    prefix: "event-details",
    date: new Date("2026-12-15"),
    endDate: new Date("2026-12-17"),
    description: "Trois jours de conferences.",
    registrationOpen: true,
  });

  await page.goto(`/e/${event.slug}`);
  await expect(page).toHaveURL(new RegExp(`/e/${event.slug}$`));
  await expect(page.getByText(/Du 15 Décembre . 2026 au 17 Décembre . 2026/)).toBeVisible();
  await expect(page.getByText("Trois jours de conferences.")).toBeVisible();
});
```

Adapter les arguments a la signature reelle de `createTestEvent`.

- [ ] **Step 3 : Spec E2E — tableau de bord**

Dans `e2e/event/dashboard.spec.ts`, ajouter un test verifiant qu'apres `loginAndEnter` en ADMIN d'evenement, la carte « Informations de l'evenement » affiche la periode, le lieu et la pastille d'ouverture des inscriptions.

- [ ] **Step 4 : Spec E2E — formulaire d'edition**

Dans `e2e/event/settings.spec.ts`, ajouter deux tests : (a) saisir une description et une date de fin, enregistrer, verifier le feedback UI **et** la valeur en base via `getDb()` ; (b) saisir une date de fin anterieure a la date de debut, enregistrer, verifier le **message d'erreur affiche** et l'absence de modification en base.

- [ ] **Step 5 : Lancer les specs**

Run : `make test-e2e -- e2e/public e2e/event/dashboard.spec.ts`
Attendu : PASS pour les nouveaux tests ; aucun **nouvel** echec par rapport a la baseline connue de la suite.

- [ ] **Step 6 : Mettre a jour la documentation**

- `docs/v4/README.md` : entree de plan + ligne d'etat d'avancement.
- `docs/v4/architecture.md` : champs `description` et `endDate` du modele `Event`, avec la mention explicite que `endDate` est informative et qu'aucune logique metier ne s'y adosse.
- `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md` : ajouter les points de controle correspondants sur les trois pages.

- [ ] **Step 7 : Verification finale**

Run : `make lint && make typecheck && make test && make test-e2e`
Attendu : tout vert (hors baseline E2E connue).

- [ ] **Step 8 : Mettre a jour le tracker**

Passer les quatre lignes du tableau `## Progression` a `[x]` avec la date du jour.

- [ ] **Step 9 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add e2e/ docs/v4/
git commit -m "test(v4): couverture e2e de l'affichage des details d'evenement"
```
