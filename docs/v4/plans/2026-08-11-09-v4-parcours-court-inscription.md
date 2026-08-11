# Parcours court : creer un compte et s'inscrire a un evenement — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-09-v4-parcours-court-inscription.md`](../specs/2026-08-11-09-v4-parcours-court-inscription.md)
**Revise :** plan 08 (le gate d'inscription passe de l'entree a la sortie)

**Goal:** Permettre a un visiteur sans compte de s'inscrire a un evenement en 5 etapes au lieu de 8, en levant le gate d'approbation de profil a l'entree et en portant la destination de bout en bout du parcours de creation de compte.

**Architecture:** Deux helpers purs portent toute la logique nouvelle. `canRegisterToEvent(status)` rejoint `src/lib/profile-review.ts`, seul module autorise a raisonner sur `profileStatus` depuis le plan 08, et remplace les quatre tests `!== "APPROVED"` disperses dans les routes d'inscription. `safeInternalPath(value)` centralise la validation du parametre `next`, aujourd'hui dupliquee et incomplete, et securise sa traversee de l'URL publique, du corps d'API et du lien e-mail. Aucun changement de schema Prisma, donc aucune migration.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript 5, Tailwind CSS 4, Prisma 6 / MySQL 8, Zod, NextAuth, nodemailer, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » de ce plan ne valent **pas** autorisation : elles decrivent le decoupage souhaite *si* un commit est demande.
2. **Aucune modification de `src/` pour faire passer un test.** Si un test revele un defaut applicatif, corriger le defaut ; ne jamais adapter le test.
3. **`src/lib/profile-review.ts` reste le seul module autorise a raisonner sur `profileStatus`** (contrainte heritee du plan 08). Aucune route ne doit comparer `profileStatus` a une chaine litterale apres ce plan.
4. **L'approbation cote organisation ne change pas.** `…/registrations/[regId]/approve/route.ts:28` continue d'exiger `APPROVED` et de renvoyer 409 `PROFILE_NOT_APPROVED`. C'est la barriere qui rend le gate amont superflu : la toucher viderait le plan de sa securite.
5. **Seuils de couverture = gate a 100%** (lignes / branches / fonctions / statements) sur `src/lib/**` et `src/app/api/**`.
6. **Les composants React ne sont pas couverts par l'unitaire** (politique de tests, section 1) : les changements d'UI sont valides par l'E2E.
7. **Aucune migration Prisma.** Ce plan ne touche pas `schema.prisma`.
8. **Contrat E2E strict :** zero `page.request.*` dans une spec, connexion via `loginAndEnter` ou le formulaire reel, URL assertee a chaque etape, chaque action assert son succes **et** son echec. Voir `e2e/README.md`.
9. **Base de tests partagee :** `make test` vide la base de dev. Relancer `make db-seed` avant toute verification manuelle dans le navigateur.
10. **Langue :** UI, e-mails et documentation en francais accentue ; identifiants, types et noms de fichiers en anglais ASCII.
11. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, puis pour les changements UI une verification reelle dans le navigateur.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Helper `safeInternalPath` + adoption dans `profile/complete` | [ ] | | Brique consommee par les tasks 3 et 4 |
| 2 | Helper `canRegisterToEvent` + les 4 points de gate + renommage du code d'erreur | [ ] | | Coeur fonctionnel |
| 3 | Propagation du `next` : `/register` → API → lien e-mail | [ ] | | |
| 4 | Page `/verify-email/[token]` : reprise du `next` | [ ] | | Ferme la chaine |
| 5 | Messages d'attente (succes + detail d'inscription) | [ ] | | UI seule, validee en E2E |
| 6 | E2E parcours nouvel arrivant + documentation | [ ] | | Comble le trou de couverture identifie le 2026-08-11 |

---

## Etat initial (constate le 2026-08-11)

Ces faits ont ete verifies dans le depot avant redaction. Les revalider si le plan est execute longtemps apres.

- `src/app/e/[slug]/page.tsx:107` emet deja `/register?next=/e/${slug}/register`. **Aucun consommateur ne lit ce parametre.**
- `src/app/register/page.tsx` est un Client Component ; il n'importe pas `useSearchParams` et affiche « Retour a la connexion » (l.59) apres succes.
- `src/app/api/auth/register/route.ts` : `bodySchema` (l.18-23) accepte `email`, `password`, `name`, `recaptchaToken`. L'appel est `sendAccountVerifyEmail(user.id, plainToken)` (l.96).
- `src/lib/mail.ts:437` : `sendAccountVerifyEmail(userId, plainToken)` construit `${baseUrl}/verify-email/${plainToken}` (l.459).
- `src/app/verify-email/[token]/page.tsx` est un Server Component qui ne recoit que `params`. Le bouton pointe sur `/login` en dur (l.29).
- Les quatre gates a modifier comparent `user.profileStatus !== "APPROVED"` :
  `src/app/e/[slug]/register/page.tsx:64`, `src/app/api/events/[slug]/register/route.ts:88`,
  `src/app/api/account/registrations/[id]/resubmit/route.ts:62`,
  `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts:134`.
- Le gate a **ne pas** modifier : `…/registrations/[regId]/approve/route.ts:28` (409).
- Tests existants qui asserent `PROFILE_NOT_APPROVED` : `src/lib/__tests__/api-event-registrations.test.ts:249` (creation staff, 403 — **a renommer**) et `:456` (approve, 409 — **a conserver**) ; `src/app/api/events/__tests__/register-event.test.ts:153-164` ; `src/app/api/account/__tests__/registrations.test.ts:478`.
- `src/components/event/RegistrationActions.tsx:43` mappe `PROFILE_NOT_APPROVED` vers « Profil non valide par la plateforme. » — ce mapping concerne l'**approbation** (409), il reste valide.
- `src/app/account/profile/complete/page.tsx:31` : `const safeNext = next && next.startsWith("/") ? next : "/account";` — seule validation existante, elle laisse passer `//evil.example`.
- `src/app/account/profile/page.tsx:63-71` porte deja les libelles de statut reutilisables.
- Helpers E2E disponibles : `mailpit.expectMail({ to, subjectPattern, bodyPattern })` et `mailpit.getBody(id)` (`e2e/helpers/mailpit.ts`), `createTestEvent({ scope })` (`e2e/helpers/db.ts:520`), fixtures `e2e/fixtures/awa-photo.jpg` et `awa-cni.pdf`.
- `createTestUser` force `profileStatus = "APPROVED"` des que `profile: true` (`e2e/helpers/db.ts:135`) : les specs existantes ne traversent jamais l'etat `PENDING`.

---

## Task 1 : Helper `safeInternalPath`

**Files:**
- Create: `src/lib/safe-path.ts`
- Create: `src/lib/__tests__/safe-path.test.ts`
- Modify: `src/app/account/profile/complete/page.tsx` (l.30-31)

**Interfaces:**
- Consomme : rien.
- Produit : `safeInternalPath(value: string | null | undefined): string | null`, consomme par les tasks 3 et 4.

- [ ] **Step 1 : Ecrire le test unitaire en echec**

Creer `src/lib/__tests__/safe-path.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/safe-path";

describe("safeInternalPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeInternalPath("/e/salon-2026/register")).toBe("/e/salon-2026/register");
  });

  it("accepte un chemin interne avec query", () => {
    expect(safeInternalPath("/account/profile?pending=1")).toBe("/account/profile?pending=1");
  });

  it("refuse une URL absolue", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBeNull();
  });

  it("refuse une URL protocol-relative", () => {
    expect(safeInternalPath("//evil.example/phish")).toBeNull();
  });

  it("refuse un chemin relatif sans slash initial", () => {
    expect(safeInternalPath("account/profile")).toBeNull();
  });

  it("refuse une chaine vide", () => {
    expect(safeInternalPath("")).toBeNull();
  });

  it("refuse null et undefined", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });

  it("refuse un backslash initial (contournement navigateur)", () => {
    expect(safeInternalPath("\\\\evil.example")).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test et verifier qu'il echoue**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/safe-path.test.ts`
Expected: FAIL — « Failed to resolve import "@/lib/safe-path" ».

- [ ] **Step 3 : Ecrire l'implementation minimale**

Creer `src/lib/safe-path.ts` :

```ts
// Valide une destination de redirection fournie par l'utilisateur (parametre `next`).
// Seul un chemin interne est accepte : ni URL absolue, ni protocol-relative (`//host`),
// ni backslash (que certains navigateurs normalisent en `/`). Renvoie null si invalide,
// a charge de l'appelant de retomber sur sa destination par defaut — jamais d'erreur
// exposant la valeur recue.
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\") || value.startsWith("\\")) return null;
  return value;
}
```

- [ ] **Step 4 : Lancer le test et verifier qu'il passe**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/safe-path.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5 : Adopter le helper dans `profile/complete`**

Dans `src/app/account/profile/complete/page.tsx`, remplacer la l.30-31 :

```ts
  // Redirection apres save uniquement vers une URL interne (next commencant par "/").
  const safeNext = next && next.startsWith("/") ? next : "/account";
```

par :

```ts
  const safeNext = safeInternalPath(next) ?? "/account";
```

et ajouter en tete de fichier :

```ts
import { safeInternalPath } from "@/lib/safe-path";
```

- [ ] **Step 6 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe ; la couverture de `src/lib/safe-path.ts` est a 100%.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/safe-path.ts src/lib/__tests__/safe-path.test.ts src/app/account/profile/complete/page.tsx
git commit -m "feat(v4): helper safeInternalPath pour les redirections next"
```

---

## Task 2 : Helper `canRegisterToEvent` et deplacement du gate

**Files:**
- Modify: `src/lib/profile-review.ts` (ajout en fin de fichier)
- Modify: `src/lib/__tests__/profile-review.test.ts` (ajout d'un `describe`)
- Modify: `src/app/e/[slug]/register/page.tsx` (l.63-66)
- Modify: `src/app/api/events/[slug]/register/route.ts` (l.85-96)
- Modify: `src/app/api/account/registrations/[id]/resubmit/route.ts` (l.61-68)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (l.133-136)
- Modify: `src/app/api/events/__tests__/register-event.test.ts` (l.153-164)
- Modify: `src/app/api/account/__tests__/registrations.test.ts` (l.478)
- Modify: `src/lib/__tests__/api-event-registrations.test.ts` (l.249 uniquement)

**Interfaces:**
- Consomme : rien.
- Produit : `canRegisterToEvent(status: ProfileStatus): boolean`, et le code d'erreur API `PROFILE_NOT_SUBMITTED` (403) en remplacement de `PROFILE_NOT_APPROVED` **sur les gates d'entree uniquement**.

- [ ] **Step 1 : Ecrire le test unitaire du helper, en echec**

Ajouter a la fin de `src/lib/__tests__/profile-review.test.ts` :

```ts
describe("canRegisterToEvent", () => {
  it("autorise un profil en attente d'examen", () => {
    expect(canRegisterToEvent("PENDING")).toBe(true);
  });

  it("autorise un profil approuve", () => {
    expect(canRegisterToEvent("APPROVED")).toBe(true);
  });

  it("refuse un profil incomplet", () => {
    expect(canRegisterToEvent("INCOMPLETE")).toBe(false);
  });

  it("refuse un profil rejete tant que les pieces ne sont pas resoumises", () => {
    expect(canRegisterToEvent("REJECTED")).toBe(false);
  });
});
```

et completer l'import en tete du fichier avec `canRegisterToEvent`.

- [ ] **Step 2 : Lancer le test et verifier qu'il echoue**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/profile-review.test.ts`
Expected: FAIL — « canRegisterToEvent is not a function ».

- [ ] **Step 3 : Implementer le helper**

Ajouter a la fin de `src/lib/profile-review.ts` :

```ts
// v4 (plan 09) : le gate d'inscription passe de l'entree a la sortie. Deposer ses
// pieces suffit pour s'inscrire ; c'est l'approbation de l'inscription par
// l'organisation qui reste conditionnee a un profil APPROVED (cf. approve/route.ts).
// REJECTED reste bloque : le participant resoumet ses pieces, ce qui le repasse
// PENDING via submitProfile() et le debloque aussitot.
export function canRegisterToEvent(status: ProfileStatus): boolean {
  return status === "PENDING" || status === "APPROVED";
}
```

et completer l'import de types en l.1 :

```ts
import type { ProfileStatus, ProfileSubmission } from "@prisma/client";
```

- [ ] **Step 4 : Lancer le test et verifier qu'il passe**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/profile-review.test.ts`
Expected: PASS.

- [ ] **Step 5 : Appliquer le gate — inscription publique**

Dans `src/app/api/events/[slug]/register/route.ts`, remplacer l.85-96 :

```ts
    // v4 (plan 09) : deposer ses pieces suffit pour s'inscrire. L'inscription
    // restera non approuvable tant que le profil n'est pas valide (cf. approve).
    if (!canRegisterToEvent(user.profileStatus)) {
      return NextResponse.json(
        {
          code: "PROFILE_NOT_SUBMITTED",
          error: "Complétez votre profil et déposez vos pièces avant de vous inscrire.",
        },
        { status: 403 },
      );
    }
```

Ajouter l'import `import { canRegisterToEvent } from "@/lib/profile-review";`.

- [ ] **Step 6 : Appliquer le gate — resoumission d'inscription**

Dans `src/app/api/account/registrations/[id]/resubmit/route.ts`, remplacer l.61-68 :

```ts
    // v4 (plan 09) : idem inscription — les pieces deposees suffisent.
    if (!canRegisterToEvent(user.profileStatus)) {
      return NextResponse.json(
        { code: "PROFILE_NOT_SUBMITTED", error: "Complétez votre profil et déposez vos pièces avant de resoumettre." },
        { status: 403 },
      );
    }
```

Ajouter le meme import.

- [ ] **Step 7 : Appliquer le gate — creation par le staff**

Dans `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts`, remplacer l.133-136 :

```ts
  // v4 (plan 09) : le participant cible doit avoir depose ses pieces.
  if (!canRegisterToEvent(user.profileStatus)) {
    return NextResponse.json({ error: "PROFILE_NOT_SUBMITTED" }, { status: 403 });
  }
```

Ajouter le meme import.

- [ ] **Step 8 : Appliquer le gate — page d'inscription**

Dans `src/app/e/[slug]/register/page.tsx`, remplacer l.63-66 :

```ts
  // v4 (plan 09) : profil complet mais pieces jamais deposees, ou rejetees.
  if (!canRegisterToEvent(user.profileStatus)) {
    redirect(`/account/profile?pending=1&next=/e/${slug}/register`);
  }
```

Ajouter l'import `import { canRegisterToEvent } from "@/lib/profile-review";`.

- [ ] **Step 9 : Mettre les tests d'integration en accord avec le nouveau comportement**

Dans `src/app/api/events/__tests__/register-event.test.ts`, le test l.153 « refuse l'inscription si le profil n'est pas approuve » decrit un comportement qui n'existe plus. Le remplacer par deux tests :

```ts
  it("autorise l'inscription d'un profil PENDING (gate deplace en sortie)", async () => {
    const user = await makeUserWithProfile({ profileStatus: "PENDING" });
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const res = await POST(
      new NextRequest(`http://localhost/api/events/${event.slug}/register`, {
        method: "POST",
        body: JSON.stringify({ categoryId: category.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ slug: event.slug }) },
    );
    expect(res.status).toBe(201);
    const reg = await prisma.registration.findFirst({ where: { userId: user.id } });
    expect(reg?.status).toBe("PENDING");
  });

  it("refuse l'inscription si les pieces ont ete rejetees (403 PROFILE_NOT_SUBMITTED)", async () => {
    const user = await makeUserWithProfile({ profileStatus: "REJECTED" });
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const res = await POST(
      new NextRequest(`http://localhost/api/events/${event.slug}/register`, {
        method: "POST",
        body: JSON.stringify({ categoryId: category.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ slug: event.slug }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PROFILE_NOT_SUBMITTED");
  });
```

Adapter les noms de helpers locaux (`makeUserWithProfile`, `withSession`, `event`, `category`) a ceux reellement utilises dans le fichier : les relire avant d'ecrire.

Appliquer la meme transformation a `src/app/api/account/__tests__/registrations.test.ts:478` (resubmit) et a `src/lib/__tests__/api-event-registrations.test.ts:249` (creation staff, ou l'assertion porte sur `.error` et non `.code`).

- [ ] **Step 10 : Verifier la non-regression du gel**

`src/lib/__tests__/api-event-registrations.test.ts:456` (approve, 409, `PROFILE_NOT_APPROVED`) **ne doit pas etre modifie**. Confirmer qu'il passe toujours :

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts`
Expected: PASS, y compris le test d'approbation gelee.

- [ ] **Step 11 : Verifier l'ensemble**

Run: `make lint && make typecheck && make test`
Expected: tout passe, couverture 100% maintenue sur `src/lib/**` et `src/app/api/**`.

- [ ] **Step 12 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/profile-review.ts src/lib/__tests__/profile-review.test.ts src/app/e src/app/api
git commit -m "feat(v4): deplace le gate d'inscription vers l'approbation"
```

---

## Task 3 : Propagation du `next` jusqu'au lien e-mail

**Files:**
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/api/auth/register/route.ts` (l.18-23 et l.96)
- Modify: `src/lib/mail.ts` (l.437-472)
- Modify: `src/app/api/auth/__tests__/register.test.ts`

**Interfaces:**
- Consomme : `safeInternalPath` (Task 1).
- Produit : `sendAccountVerifyEmail(userId: string, plainToken: string, next?: string | null): Promise<void>` — signature elargie, troisieme parametre optionnel pour ne casser aucun appelant existant.

- [ ] **Step 1 : Ecrire les tests d'integration en echec**

Ajouter a `src/app/api/auth/__tests__/register.test.ts` :

```ts
  it("propage un next interne jusqu'au lien de verification", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "next-ok@test.local",
          password: "secret123",
          name: "Awa",
          next: "/e/salon-2026/register",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "/e/salon-2026/register",
    );
  });

  it("ignore un next externe sans faire echouer l'inscription", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "next-evil@test.local",
          password: "secret123",
          name: "Awa",
          next: "https://evil.example/phish",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(sendAccountVerifyEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      null,
    );
  });
```

Reprendre le motif de mock de `sendAccountVerifyEmail` deja present en tete du fichier ; le relire avant d'ecrire.

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/auth/__tests__/register.test.ts`
Expected: FAIL — `sendAccountVerifyEmail` est appele avec deux arguments seulement.

- [ ] **Step 3 : Elargir le schema et l'appel dans la route**

Dans `src/app/api/auth/register/route.ts`, ajouter au `bodySchema` (l.18-23) :

```ts
  next: z.string().max(512).optional(),
```

et remplacer l.96 :

```ts
  await sendAccountVerifyEmail(user.id, plainToken, safeInternalPath(parsed.data.next));
```

Ajouter `import { safeInternalPath } from "@/lib/safe-path";`.

- [ ] **Step 4 : Porter le `next` dans l'URL du lien**

Dans `src/lib/mail.ts`, changer la signature l.437 :

```ts
export async function sendAccountVerifyEmail(
  userId: string,
  plainToken: string,
  next?: string | null,
): Promise<void> {
```

et remplacer la construction du lien (l.459) :

```ts
  const verifyUrl = next
    ? `${baseUrl}/verify-email/${plainToken}?next=${encodeURIComponent(next)}`
    : `${baseUrl}/verify-email/${plainToken}`;
```

en utilisant `${verifyUrl}` dans le `href` du bouton. Le libelle du bouton devient « Confirmer mon email et continuer » quand `next` est renseigne, « Confirmer mon email » sinon.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/auth/__tests__/register.test.ts`
Expected: PASS.

- [ ] **Step 6 : Lire et transmettre le `next` cote formulaire**

Dans `src/app/register/page.tsx` :

- Importer `useSearchParams` depuis `next/navigation` et `safeInternalPath` depuis `@/lib/safe-path`.
- Lire `const next = safeInternalPath(useSearchParams().get("next"));`
- Ajouter `next` au corps du `fetch` (l.34) : `body: JSON.stringify({ email, password, name, next })`.
- Dans l'ecran de succes (l.51-61), remplacer le lien « Retour a la connexion » par un texte qui reflete la suite quand `next` est renseigne :

```tsx
          <p className="text-sm text-slate-700">
            Nous vous avons envoyé un email à <strong>{email}</strong> pour confirmer votre adresse.
            {next
              ? " Cliquez sur le lien reçu pour activer votre compte et reprendre votre inscription."
              : " Cliquez sur le lien reçu pour activer votre compte."}
          </p>
```

`useSearchParams` impose un `<Suspense>` cote App Router : encapsuler le corps de la page dans un composant interne rendu sous `<Suspense fallback={null}>`, comme le fait deja `src/app/login/page.tsx` — relire ce fichier pour reprendre exactement le meme motif.

- [ ] **Step 7 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe.

- [ ] **Step 8 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/register/page.tsx src/app/api/auth/register/route.ts src/lib/mail.ts src/app/api/auth/__tests__/register.test.ts
git commit -m "feat(v4): porte la destination next jusqu'au lien de verification"
```

---

## Task 4 : Reprise du `next` sur la page de verification

**Files:**
- Modify: `src/app/verify-email/[token]/page.tsx`

**Interfaces:**
- Consomme : `safeInternalPath` (Task 1), le parametre `?next=` pose par la Task 3.
- Produit : rien pour les tasks suivantes.

- [ ] **Step 1 : Accepter `searchParams` et calculer la destination**

Dans `src/app/verify-email/[token]/page.tsx`, elargir la signature :

```tsx
export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;
  const target = safeInternalPath(next);
  const loginHref = target ? `/login?callbackUrl=${encodeURIComponent(target)}` : "/login";
```

Ajouter `import { safeInternalPath } from "@/lib/safe-path";`.

- [ ] **Step 2 : Utiliser la destination dans le bouton de succes**

Remplacer le bloc l.25-33 :

```tsx
        <p className="text-sm text-slate-600">
          {target
            ? "Votre adresse e-mail a bien été confirmée. Connectez-vous pour reprendre votre inscription."
            : "Votre adresse e-mail a bien été confirmée. Vous pouvez maintenant vous connecter."}
        </p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          {target ? "Continuer mon inscription" : "Se connecter"}
        </Link>
```

Le bloc d'erreur (lien invalide ou expire) n'est pas modifie : sans compte active, il n'y a pas d'inscription a reprendre.

- [ ] **Step 3 : Verifier**

Run: `make lint && make typecheck`
Expected: passe. Aucun test unitaire ici — Server Component, couvert par l'E2E de la Task 6 (politique de tests, section 1).

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/verify-email/\[token\]/page.tsx
git commit -m "feat(v4): la page de verification reprend le fil de l'inscription"
```

---

## Task 5 : Messages d'attente

**Files:**
- Modify: `src/app/e/[slug]/success/page.tsx`
- Modify: `src/app/account/registrations/[id]/page.tsx`

**Interfaces:**
- Consomme : rien.
- Produit : rien.

- [ ] **Step 1 : Afficher l'etat du profil sur la page de succes**

`src/app/e/[slug]/success/page.tsx` est un Server Component qui ne lit pas la session. Ajouter la lecture du statut de profil :

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
```

puis, apres la resolution de `settings` :

```tsx
  const session = await getServerSession(authOptions);
  const profileStatus = session?.user?.id
    ? (await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { profileStatus: true },
      }))?.profileStatus
    : undefined;
```

et, sous le paragraphe existant (l.34-37), le rappel conditionnel :

```tsx
          {profileStatus === "PENDING" && (
            <p className="mx-auto mt-3 max-w-[440px] text-sm text-sky-700">
              Vos pièces d&apos;identité sont en cours de vérification par la plateforme. Votre inscription
              sera examinée par l&apos;organisateur une fois cette vérification terminée.
            </p>
          )}
```

- [ ] **Step 2 : Ajuster le libelle du detail d'inscription**

`src/app/account/registrations/[id]/page.tsx:78` affiche **deja** l'encart voulu : la requete selectionne `user: { select: { profileStatus: true } }` (l.37) et l'alerte s'affiche quand `registration.status === "PENDING" && registration.user.profileStatus !== "APPROVED"`. Aucun ajout n'est necessaire.

Seul le texte est a revoir : « Votre inscription ne peut pas être traitée tant que votre profil n'est pas validé » decrivait un blocage a l'entree. Le remplacer par une formulation qui reflete l'ordre reel des operations (l.82-84) :

```tsx
            <p className="mt-1 text-[13px]">
              Vos pièces sont en cours de vérification par la plateforme. Votre inscription sera examinée
              par l&apos;organisateur une fois cette vérification terminée.{" "}
              <Link href="/account/profile" className="text-green-700 underline">
                Voir mon profil
              </Link>
            </p>
```

- [ ] **Step 3 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe.

- [ ] **Step 4 : Verification navigateur**

Apres `make db-seed`, se connecter avec un compte de demonstration au profil `PENDING` et parcourir l'inscription jusqu'a la page de succes. Confirmer visuellement l'encart bleu.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/e/\[slug\]/success/page.tsx src/app/account/registrations/\[id\]/page.tsx
git commit -m "feat(v4): signale la verification des pieces en attente"
```

---

## Task 6 : E2E du parcours nouvel arrivant et documentation

**Files:**
- Create: `e2e/public/event-register-newcomer.spec.ts`
- Modify: `docs/v4/features/validation-profils.md`
- Modify: `docs/v4/architecture.md`
- Modify: `docs/v4/specs/2026-08-07-08-v4-validation-documents-staff-plateforme.md` (note de revision)
- Modify: `e2e/README.md` (si la liste des specs y est enumeree — verifier)

**Interfaces:**
- Consomme : tout ce qui precede.
- Produit : rien.

- [ ] **Step 1 : Ecrire la spec E2E du parcours complet**

Creer `e2e/public/event-register-newcomer.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestUser,
  createTestRegistration,
  createTestProfileSubmission,
  createTestStaff,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs, loginAsEventMember } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";

const FIXTURES = path.join(__dirname, "..", "fixtures");

test.describe("Parcours complet d'un nouvel arrivant", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("cree un compte depuis l'evenement et s'inscrit sans attendre la validation", async ({ page }) => {
    const { eventSlug } = await createTestEvent({ scope: "newcomer" });
    const email = `e2e-newcomer-${Date.now()}@e2e.local`;
    const password = "Test1234!";

    // 1. Page publique : le CTA mene a la creation de compte en gardant la destination.
    await page.goto(`/e/${eventSlug}`);
    await page.getByRole("link", { name: /créer un compte/i }).click();
    await expect(page).toHaveURL(new RegExp(`/register\\?next=/e/${eventSlug}/register`));

    // 2. Creation du compte.
    await page.getByLabel("Nom complet").fill("Awa Diallo");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByLabel(/Confirmer le mot de passe/).fill(password);
    await page.getByRole("button", { name: /créer mon compte/i }).click();
    await expect(page.getByText(/reprendre votre inscription/i)).toBeVisible();

    // 3. Lien de verification recupere dans Mailpit, avec la destination portee.
    const mail = await mailpit.expectMail({
      to: email,
      subjectPattern: /Confirmez votre adresse email/i,
    });
    const body = await mailpit.getBody(mail.ID);
    const match = body.HTML.match(/\/verify-email\/([A-Za-z0-9_-]+)\?next=([^"']+)/);
    expect(match).not.toBeNull();
    const verifyPath = `/verify-email/${match![1]}?next=${match![2]}`;

    await page.goto(verifyPath);
    await expect(page.getByRole("link", { name: /continuer mon inscription/i })).toBeVisible();
    await page.getByRole("link", { name: /continuer mon inscription/i }).click();
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);

    // 4. Connexion, puis redirection automatique vers la completion du profil.
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/\/account\/profile\/complete/, { timeout: 20000 });

    // 5. Depot des pieces.
    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom").fill("Diallo");
    await page.getByLabel("Structure").fill("ACME");
    await page.setInputFiles('input[type="file"][name="photo"]', path.join(FIXTURES, "awa-photo.jpg"));
    await page.setInputFiles('input[type="file"][name="idDocument"]', path.join(FIXTURES, "awa-cni.pdf"));
    await page.getByLabel(/type de pièce/i).selectOption({ index: 1 });
    await page.getByLabel(/numéro de pièce/i).fill("CNI-123456");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    // 6. Retour automatique sur l'inscription, sans attendre la validation staff.
    await page.waitForURL(new RegExp(`/e/${eventSlug}/register`), { timeout: 20000 });
    await page.getByRole("radio", { name: /visiteur/i }).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /s'inscrire/i }).click();
    await page.waitForURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 20000 });
    await expect(page.getByText(/en cours de vérification par la plateforme/i)).toBeVisible();

    // 7. Etat en base : inscription creee, profil en attente d'examen.
    const prisma = getDb();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.profileStatus).toBe("PENDING");
    const reg = await prisma.registration.findFirst({ where: { userId: user!.id } });
    expect(reg?.status).toBe("PENDING");
  });
});
```

Les libelles exacts des champs du profil (`Prénom`, `Structure`, attributs `name` des inputs fichier, libelle du select de type de piece) doivent etre **relus dans `src/app/account/profile/ProfileForm.tsx`** avant d'ecrire le test : ne pas deviner. Idem pour le libelle du bouton d'enregistrement.

- [ ] **Step 2 : Lancer la spec et verifier qu'elle passe**

Run: `docker compose -f docker-compose.dev.yml exec app yarn playwright test e2e/public/event-register-newcomer.spec.ts`
Expected: 1 test vert. En cas d'echec sur un selecteur, corriger le **test** d'apres le composant reel — jamais l'inverse (contrainte 2).

- [ ] **Step 3 : Ajouter le second test — le gel puis le deblocage**

Dans la meme `describe`, ajouter un test qui prouve la barriere de sortie :

```ts
  test("l'organisation ne peut approuver qu'apres validation du profil par la plateforme", async ({ page }) => {
    const { orgId, eventId, eventSlug, categoryId } = await createTestEvent({ scope: "gel-org" });
    const participant = await createTestUser({
      scope: "gel-part",
      verified: true,
      profile: true,
      profileStatus: "PENDING",
    });
    const { id: regId } = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
    });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });

    // 1. Membre de l'organisation : l'approbation est refusee (profil non valide).
    const member = await loginAsEventMember(page, {
      orgId,
      eventId,
      role: "ADMIN",
      scope: "gel-member",
    });
    await page.goto(`/event/${eventId}/registrations/${regId}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${regId}`));
    await page.getByRole("button", { name: /approuver/i }).click();
    await expect(page.getByText(/profil non validé par la plateforme/i)).toBeVisible();

    const prisma = getDb();
    expect((await prisma.registration.findUnique({ where: { id: regId } }))?.status).toBe("PENDING");

    // 2. Le staff plateforme valide le profil.
    const staff = await createTestStaff({ role: "STAFF_SUPPORT", scope: "gel-staff" });
    await page.goto("/api/auth/signout");
    await loginAs(page, staff);
    await page.goto(`/platform/profiles/${participant.id}`);
    await expect(page).toHaveURL(new RegExp(`/platform/profiles/${participant.id}`));
    await page.getByRole("button", { name: /approuver/i }).click();
    await expect(page.getByText(/approuvé/i).first()).toBeVisible();
    expect((await prisma.user.findUnique({ where: { id: participant.id } }))?.profileStatus).toBe("APPROVED");

    // 3. Le membre de l'organisation peut desormais approuver l'inscription.
    await page.goto("/api/auth/signout");
    await loginAs(page, member);
    await page.goto(`/event/${eventId}/registrations/${regId}`);
    await page.getByRole("button", { name: /approuver/i }).click();
    await expect(page.getByText(/profil non validé par la plateforme/i)).toBeHidden();
    await expect
      .poll(async () => (await prisma.registration.findUnique({ where: { id: regId } }))?.status)
      .toBe("APPROVED");

    expect(eventSlug).toBeTruthy();
  });
```

Deux points a verifier dans le depot avant d'ecrire ce test, sans rien deviner : l'URL reelle du detail d'inscription cote espace evenement (relire `src/app/event/[eventId]/registrations/[regId]/page.tsx`), et la facon dont les autres specs deconnectent un utilisateur — `e2e/transverse/logout.spec.ts` fait autorite, `/api/auth/signout` ci-dessus est a remplacer par le motif qu'il utilise. Le libelle « Profil non validé par la plateforme. » vient de `src/components/event/RegistrationActions.tsx:43`.

- [ ] **Step 4 : Mettre a jour la documentation**

- `docs/v4/features/validation-profils.md` : la section decrivant le gate d'inscription passe de « profil approuve requis pour s'inscrire » a « pieces deposees requises pour s'inscrire ; profil approuve requis pour que l'organisation approuve ».
- `docs/v4/architecture.md` : le parcours d'inscription et le nouveau code d'erreur `PROFILE_NOT_SUBMITTED`.
- `docs/v4/specs/2026-08-07-08-…md` : ajouter sous le tableau des decisions une note datee :

```markdown
> **Revision 2026-08-11** — Les lignes « Gate d'inscription » et « Objet validé » de ce
> tableau sont révisées par [`2026-08-11-09-v4-parcours-court-inscription.md`](2026-08-11-09-v4-parcours-court-inscription.md) :
> le gate passe de l'entrée (interdire l'inscription) à la sortie (interdire l'approbation).
> Le reste de cette spec — historique immuable, catalogue de motifs, gel — reste en vigueur.
```

- [ ] **Step 5 : Verification finale**

Run: `make lint && make typecheck && make test`
Expected: tout passe, couverture 100% maintenue.

Run: `docker compose -f docker-compose.dev.yml exec app yarn playwright test e2e/public/`
Expected: comparer le resultat a la baseline connue comme instable (~53 echecs preexistants lies au mail et aux courses sur la base partagee). Seuls comptent les echecs **nouveaux** sur les specs touchees.

- [ ] **Step 6 : Verification navigateur du parcours complet**

Apres `make db-seed`, sur `https://badge.local` : partir d'un evenement public, creer un compte avec une adresse neuve, recuperer le mail sur `https://mail.badge.local`, suivre le lien, et verifier qu'on arrive sur l'inscription **sans jamais retaper une URL**. C'est le critere d'acceptation du plan.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add e2e/public/event-register-newcomer.spec.ts docs/v4
git commit -m "test(v4): parcours e2e du nouvel arrivant + doc du gate deplace"
```
