# Corrections de bugs applicatifs (pre-requis reorganisation E2E) — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal:** Corriger les trois bugs applicatifs decouverts pendant la cartographie E2E, afin que la suite de tests reorganisee puisse passer **sans `test.fixme` ni `test.skip` de contournement** : (1) verify-email casse par un self-fetch SSR, (2) role event PRINTER refuse sur l'espace Badges vers lequel sa propre nav l'envoie, (3) page publique orpheline `/badge/[id]` cassee depuis la v2.

**A executer AVANT** le plan [`2026-07-20-03-v4-e2e-reorg-par-page.md`](2026-07-20-03-v4-e2e-reorg-par-page.md) : ce dernier suppose ces bugs corriges (il de-fixme verify-email, inverse l'assertion PRINTER 403->200, et retire le flux de telechargement `/badge/[id]`). La Task 4 de ce plan met a jour ce plan-la en consequence.

**Architecture:** Trois corrections independantes, chacune alignee sur un pattern deja present dans le code :
1. **verify-email** : extraire la logique de verification dans un helper `src/lib/verify-email.ts` appele **directement** par le Server Component (pattern `setup-password`), supprimant le self-fetch HTTP vers `NEXTAUTH_URL`.
2. **PRINTER/badges** : garder les routes du parcours badges par la **permission** `badge.print` (qui inclut deja PRINTER dans `EVENT_PERMISSION_ROLES`) au lieu de `minRole` (hierarchie descendante ou PRINTER n'est jamais satisfait), via un **endpoint badges dedie a DTO minimal** (moindre privilege) + ajout d'un mode `permission` a `withEventAuth`.
3. **/badge/[id]** : **suppression** de la page orpheline (aucun lien entrant ; QR pointe vers `/verify/[badgeId]`) et de son composant exclusif.

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript 5, Zod, Vitest 4 (unitaire + integration MySQL), Playwright (E2E).

## Global Constraints

- **Version cible : v4.** Doc dans `docs/v4/`.
- **Ce plan MODIFIE le code applicatif `src/`** : ce sont de vraies corrections de bugs, distinctes de la regle « ne jamais modifier src pour faire passer un test » (qui interdit d'adapter le code a un test existant, pas de corriger un bug reel avec son test de non-regression).
- **Un helper avant une route** : privilegier l'extraction de logique reutilisable (verify-email) plutot que la duplication.
- **Moindre privilege** (bug PRINTER) : le DTO expose au PRINTER ne contient QUE ce qui est necessaire a l'impression (nom, categorie, `badgePrinted`, `allAccessGranted`) — pas d'email ni de structure des inscrits.
- **Audit & securite** : ne pas introduire de `logActivity(BADGE_SCANNED)` sur un chemin de telechargement/preview (ce serait un faux scan). Ne jamais exposer de secret/PII au-dela du strict necessaire.
- **Langue** : UI/messages FR avec accents ; identifiants/anglais ; commentaires FR (style ASCII des fichiers).
- **Pas de mock Prisma ni des regles metier** : tests unitaires du helper + integration des routes sur vraie MySQL de dev ; E2E sur stack complete.
- **Avant tout commit** : `make lint && make typecheck && make test` (+ run E2E cible). Commits FR ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur.**
- **`make test` efface les donnees dev** : re-seed (`make db-seed`) au besoin.
- **Conserver ce plan** (marquer la Progression, ne pas supprimer sans demande).

## Decisions (validees avec l'utilisateur)

- **Bug badge `/badge/[id]`** : **supprimer** la page (ilot v1 orphelin, aucun lien entrant), plutot que recreer sa route data.
- **Bug PRINTER** : **endpoint badges dedie** garde par `badge.print`, DTO minimal ; + corriger `badges/[badgeId]` et `registrations/print` pour garder par `badge.print`.
- **Bug verify-email** : helper `consumeEmailVerifyToken` appele en direct par le Server Component (pas de decision ouverte).

---

## Progression

| Task | Bug | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | verify-email : self-fetch SSR -> helper direct | [x] | 2026-07-20 | Helper `consumeEmailVerifyToken` + page sans self-fetch + route deleguee. Durcissement `blocked`. 1234 vitest verts, 7/7 e2e auth-register (2 ex-fixme actifs). |
| 2 | PRINTER : endpoint badges dedie + garde par permission | [ ] | | |
| 3 | /badge/[id] : suppression de la page orpheline | [ ] | | |
| 4 | Verification finale + MAJ du plan E2E + doc | [ ] | | |

---

## Task 1 : verify-email — remplacer le self-fetch SSR par un helper direct

**Cause racine** : `src/app/verify-email/[token]/page.tsx` (Server Component) construit une URL depuis `NEXTAUTH_URL`/`BASE_URL` (L24-30) et fait `fetch(POST /api/auth/verify-email)` (L10-21). En conteneur, `NEXTAUTH_URL=https://badge.local` n'est pas resolu -> le fetch echoue -> `catch` -> `{ ok:false }` -> ecran « Lien invalide » quel que soit le token. D'ou les `test.fixme` `e2e/public/auth-register.spec.ts:47,101`.

**Files:**
- Create: `src/lib/verify-email.ts`
- Create: `src/lib/__tests__/verify-email.test.ts`
- Modify: `src/app/verify-email/[token]/page.tsx`
- Modify: `src/app/api/auth/verify-email/route.ts`
- Modify: `e2e/public/auth-register.spec.ts`

**Interfaces:**
- Produces :
```ts
export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "already-verified" }
  | { status: "invalid-or-expired" };

export async function consumeEmailVerifyToken(
  token: string,
  opts?: { req?: NextRequest },
): Promise<VerifyEmailResult>;
```
- Consumes : `hashToken`, `isExpired` (`src/lib/auth-tokens.ts`), `prisma`, `logActivity`.

- [x] **Step 1 : Ecrire le test unitaire du helper (echoue).** `src/lib/__tests__/verify-email.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken, computeExpiry, EMAIL_VERIFY_TTL_MS } from "@/lib/auth-tokens";
import { consumeEmailVerifyToken } from "@/lib/verify-email";

async function seedUser(opts: { verified?: boolean; expired?: boolean }) {
  const token = generateToken();
  const user = await prisma.user.create({
    data: {
      email: `verify-${Date.now()}-${Math.random()}@v2-11-e2e.test`,
      name: "V",
      password: "x",
      emailVerifiedAt: opts.verified ? new Date() : null,
      emailVerifyToken: hashToken(token),
      emailVerifyTokenExpiry: opts.expired ? new Date(Date.now() - 1000) : computeExpiry(EMAIL_VERIFY_TTL_MS),
    },
  });
  return { token, user };
}

describe("consumeEmailVerifyToken", () => {
  it("verifie un token valide", async () => {
    const { token, user } = await seedUser({});
    const r = await consumeEmailVerifyToken(token);
    expect(r.status).toBe("verified");
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifiedAt).not.toBeNull();
    expect(after?.emailVerifyToken).toBeNull(); // consomme
  });

  it("idempotent : deja verifie", async () => {
    const { token } = await seedUser({ verified: true });
    expect((await consumeEmailVerifyToken(token)).status).toBe("already-verified");
  });

  it("token expire -> invalid-or-expired", async () => {
    const { token } = await seedUser({ expired: true });
    expect((await consumeEmailVerifyToken(token)).status).toBe("invalid-or-expired");
  });

  it("token inconnu -> invalid-or-expired", async () => {
    expect((await consumeEmailVerifyToken("inexistant")).status).toBe("invalid-or-expired");
  });
});
```

- [x] **Step 2 : Lancer, verifier l'echec.** Run : `make test -- src/lib/__tests__/verify-email.test.ts` — Expected : FAIL (module absent).

- [x] **Step 3 : Implementer `src/lib/verify-email.ts`** (deplacer le coeur metier de la route, L38-79) :

```ts
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, isExpired } from "@/lib/auth-tokens";
import { logActivity } from "@/lib/activity-log";

export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "already-verified" }
  | { status: "invalid-or-expired" };

export async function consumeEmailVerifyToken(
  token: string,
  opts?: { req?: NextRequest },
): Promise<VerifyEmailResult> {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: tokenHash },
    select: { id: true, emailVerifiedAt: true, emailVerifyTokenExpiry: true, archived: true, blocked: true },
  });
  if (!user || user.archived || user.blocked || isExpired(user.emailVerifyTokenExpiry)) {
    return { status: "invalid-or-expired" };
  }
  if (user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: null, emailVerifyTokenExpiry: null },
    });
    return { status: "already-verified" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyTokenExpiry: null },
  });
  await logActivity({ type: "USER_EMAIL_VERIFIED", userId: user.id, targetId: user.id, req: opts?.req });
  return { status: "verified" };
}
```

> Note : ajout du test `user.blocked` (aligne sur reset-password ; la route actuelle selectionne `blocked` sans le tester — c'est un durcissement coherent).

- [x] **Step 4 : Lancer le test, verifier le succes.** Run : `make test -- src/lib/__tests__/verify-email.test.ts` — Expected : PASS (4 tests).

- [x] **Step 5 : Reecrire la page en Server Component sans fetch.** `src/app/verify-email/[token]/page.tsx` : supprimer `verifyToken()` (L6-22) et `resolveBaseUrl()` (L24-30). Remplacer par :

```ts
import { consumeEmailVerifyToken } from "@/lib/verify-email";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await consumeEmailVerifyToken(token);
  const ok = result.status === "verified" || result.status === "already-verified";
  const alreadyVerified = result.status === "already-verified";
  // ... conserver le meme JSX (AuthCard succes si ok, erreur sinon), avec `alreadyVerified`.
}
```

Plus aucune dependance a `BASE_URL`/`NEXTAUTH_URL`.

- [x] **Step 6 : Deleguer la route API au helper (dedup).** `src/app/api/auth/verify-email/route.ts` : garder rate-limit (L20-27) + Zod (L29-36) ; remplacer L38-79 par :

```ts
const r = await consumeEmailVerifyToken(parsed.data.token, { req });
if (r.status === "invalid-or-expired") {
  return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN", code: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
}
return NextResponse.json({ ok: true, alreadyVerified: r.status === "already-verified" });
```

- [x] **Step 7 : De-fixmer les tests E2E.** `e2e/public/auth-register.spec.ts` : retirer `.fixme` L47 et L101, supprimer les commentaires de limitation (L42-46, L98-100).

- [x] **Step 8 : Verifier.** Run : `make lint && make typecheck && make test`. Puis E2E cible :
`docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/public/auth-register.spec.ts` — Expected : les 2 tests ex-fixme passent (verify-email golden path + double consommation idempotente).

- [x] **Step 9 : Commit** (si demande) : `fix(v4): verify-email sans self-fetch SSR (helper direct)`.

---

## Task 2 : PRINTER — endpoint badges dedie garde par `badge.print`

**Cause racine** : les routes qui alimentent `/event/[eventId]/badges` gardent par `minRole` (`registrations` = `OPERATOR` ; `badges/[badgeId]` = `VIEWER` ; `registrations/print` = `OPERATOR`+). La hierarchie (`auth-guards.ts:81-85`) est descendante : `OPERATOR` englobe `PRINTER`, jamais l'inverse -> un PRINTER pur (rang `PRINTER`) n'est jamais satisfait -> 403. Or `EVENT_PERMISSION_ROLES["badge.print"] = ["ADMIN","OPERATOR","PRINTER"]` (`auth-helpers.ts:51`) autorise explicitement PRINTER. La nav `EventPrinterShell` l'envoie pourtant sur `/badges`. Reference : `e2e/event/badges-print.spec.ts:53`.

**Files:**
- Modify: `src/lib/with-event-auth.ts` (ajouter le mode `permission`)
- Create: `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts` (GET liste, DTO minimal)
- Create: `src/app/api/org/[orgId]/events/[eventId]/badges/__tests__/route.test.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx` (garde `badge.print`)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/registrations/print/route.ts` (garde `badge.print`)
- Modify: `src/components/event/BadgeListTable.tsx` (fetch le nouvel endpoint ; retirer `email` du DTO)
- Modify: `e2e/event/badges-print.spec.ts` (inverser 403 -> 200, retirer les notes « discrepance »)

**Interfaces:**
- Produces (endpoint) : `GET /api/org/[orgId]/events/[eventId]/badges` -> `{ registrations: BadgeRow[] }` avec `BadgeRow = { id, firstName, lastName, badgePrinted, allAccessGranted, category: { name, color, number } }` (**sans email ni structure** — moindre privilege).
- Produces (garde) : `withEventAuth({ permission: "badge.print" }, handler)` en plus de `withEventAuth({ minRole })`.

- [ ] **Step 1 : Ajouter le mode `permission` a `withEventAuth`.** `src/lib/with-event-auth.ts` :

```ts
import { AuthError, requireEventRole, requireEventPermission, getEffectiveEventRole } from "@/lib/auth-guards";
import type { EventPermission } from "@/lib/auth-helpers";

export type WithEventAuthOptions = {
  minRole?: EventRole;
  permission?: EventPermission;
  allowArchived?: boolean;
  requireRegistrationOpen?: boolean;
};
```

Dans le corps, remplacer le bloc `requireEventRole(..., options.minRole)` (L64-71) par :

```ts
try {
  if (options.permission) {
    await requireEventPermission(session.user.id, eventId, options.permission);
  } else if (options.minRole) {
    await requireEventRole(session.user.id, eventId, options.minRole);
  } else {
    throw new Error("withEventAuth: minRole ou permission requis");
  }
} catch (err) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.httpStatus });
  }
  throw err;
}
```

> Verifier la signature reelle de `requireEventPermission` dans `src/lib/auth-guards.ts` (le CLAUDE.md la liste parmi les helpers). Si elle prend `(userId, eventId, permission)` et throw `AuthError` comme `requireEventRole`, l'usage ci-dessus est direct ; sinon l'adapter (ex. charger le contexte + `hasEventPermission`).

- [ ] **Step 2 : Ecrire le test d'integration de l'endpoint badges (echoue).** `.../badges/__tests__/route.test.ts` (harness d'integration du repo ; vraie MySQL) : un **PRINTER pur** (event membership PRINTER, sans org membership) obtient **200** sur `GET .../badges` avec un DTO **sans email** ; un **VIEWER** obtient **403** ; le DTO ne contient que les APPROVED.

```ts
// golden : PRINTER pur -> 200, liste APPROVED, DTO minimal (pas d'email)
// negatif : VIEWER -> 403
// (adapter seedEvent/seedEventMember/callRoute au harness d'integration voisin)
```

- [ ] **Step 3 : Lancer, verifier l'echec.** Run : `make test -- badges/__tests__/route.test.ts` — Expected : FAIL (route absente).

- [ ] **Step 4 : Creer l'endpoint dedie.** `.../badges/route.ts` :

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

export const GET = withEventAuth({ permission: "badge.print", allowArchived: true }, async (_req, { eventId }) => {
  const registrations = await prisma.registration.findMany({
    where: { eventId, status: "APPROVED" },
    select: {
      id: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      badgePrinted: true,
      allAccessGranted: true,
      category: { select: { name: true, color: true, number: true } },
    },
    orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
    take: 200,
  });
  return NextResponse.json({
    registrations: registrations.map((r) => ({
      id: r.id,
      firstName: r.snapshotFirstName,
      lastName: r.snapshotLastName,
      badgePrinted: r.badgePrinted,
      allAccessGranted: r.allAccessGranted,
      category: r.category,
    })),
  });
});
```

> Confirmer les noms de colonnes snapshot dans `prisma/schema.prisma` (le rapport cite `snapshotFirstName`/`snapshotLastName`). Pas de `logActivity` (lecture pour impression, pas un scan).

- [ ] **Step 5 : Corriger les deux routes badges existantes.**
  - `.../badges/[badgeId]/route.tsx` (L26-27) : passer de `withEventAuth({ minRole: "VIEWER" })` a `withEventAuth({ permission: "badge.print" })`. Retirer le double-verrou : le check `hasEventPermission(..., "badge.print")` interne (L42-44) devient redondant avec la garde — le garder OU le retirer, mais ne plus bloquer par `minRole VIEWER` en amont.
  - `.../registrations/print/route.ts` : passer la garde a `withEventAuth({ permission: "badge.print" })`.

- [ ] **Step 6 : Pointer le client sur le nouvel endpoint.** `src/components/event/BadgeListTable.tsx` :
  - L30 : `fetch(`/api/org/${orgId}/events/${eventId}/badges`)` (au lieu de `registrations?status=APPROVED&limit=100`).
  - Type `Row` (L10-18) : **retirer `email`** (plus renvoye ; verifier qu'il n'est pas affiche/utilise ailleurs dans le composant, sinon adapter).

- [ ] **Step 7 : Inverser le test E2E.** `e2e/event/badges-print.spec.ts` (L53-81) : le PRINTER pur doit desormais obtenir **200** sur `GET .../badges` (et le PDF) ; retirer les notes « discrepance » (L16-23, L79) et le commentaire « requireEventRole VIEWER rejette PRINTER ».

- [ ] **Step 8 : Lancer le test d'integration + E2E.** Run : `make test -- badges/__tests__/route.test.ts` — Expected : PASS. Puis `... yarn playwright test e2e/event/badges-print.spec.ts` — Expected : PASS (PRINTER 200).

- [ ] **Step 9 : Verifier globalement.** Run : `make lint && make typecheck && make test`. Verifier qu'aucune autre route ne regressait (les autres appels a `withEventAuth({ minRole })` restent valides — `minRole` est desormais optionnel mais toujours supporte).

- [ ] **Step 10 : Verification navigateur.** Connecter un utilisateur **PRINTER pur** sur un event : `https://badge.local/event/<id>/badges` affiche la liste des badges (plus de liste vide silencieuse), « Marquer imprimes » et l'apercu PDF fonctionnent.

- [ ] **Step 11 : Commit** (si demande) : `fix(v4): acces PRINTER aux badges via permission badge.print (endpoint dedie)`.

---

## Task 3 : /badge/[id] — supprimer la page orpheline

**Cause racine** : `src/app/badge/[id]/page.tsx` (client) fetch `/api/verify/${id}` (L24), route **supprimee** au nettoyage v2 (`454879f`) et jamais remigree. Sa shape attendue est du v1 (`registration`, `photo`, `team`, `event.location`, `allAccessGranted`). **Aucun lien n'y mene** dans tout le code (verifie : le QR pointe vers `/verify/[badgeId]`). Decision : suppression.

**Files:**
- Delete: `src/app/badge/[id]/page.tsx`
- Delete: `src/components/badge/BadgeDownload.tsx` (composant **exclusif** a cette page)
- Modify/Delete: le test de download dans `e2e/public/badge-public.spec.ts` (L120, `test.skip` du flux `/badge/[id]`)

- [ ] **Step 1 : Confirmer l'exclusivite des fichiers a supprimer.**
Run : `grep -rn "components/badge/BadgeDownload\b\|from \"@/components/badge/BadgeDownload\"" src/` — Expected : references uniquement depuis `src/app/badge/[id]/page.tsx`.
Run : `grep -rn "app/badge/\[id\]\|href=.*/badge/\|\"/badge/\|`/badge/" src/` — Expected : aucune reference entrante (hors la page elle-meme).
> **Ne PAS supprimer** `src/components/badge/BadgeDownloadV2.tsx` (utilise par l'espace event) ni les sous-composants partages (`BadgeDocument`, `BadgeProps`…) que `BadgeDownload` importe s'ils servent aussi a `BadgeDownloadV2`. Verifier chaque import de `BadgeDownload.tsx` : ne supprimer que ce qui est **exclusif**.

- [ ] **Step 2 : Supprimer la page et le composant.**
Run : `git rm src/app/badge/[id]/page.tsx src/components/badge/BadgeDownload.tsx`
(Si `src/app/badge/` devient vide, retirer aussi le dossier.)

- [ ] **Step 3 : Retirer le test de download orphelin.** `e2e/public/badge-public.spec.ts` : supprimer le `test.skip` L120-138 (flux `/badge/[id] download`) et son commentaire de bug. Les tests de `/verify/[badgeId]` (verification publique) **restent** inchanges.

- [ ] **Step 4 : Verifier l'absence de casse.** Run : `make lint && make typecheck` — Expected : succes (aucun import mort). Run : `make test` — Expected : vert.

- [ ] **Step 5 : Verification navigateur.** `https://badge.local/badge/nimporte` renvoie desormais un **404** (route supprimee), comportement attendu.

- [ ] **Step 6 : Commit** (si demande) : `chore(v4): retire la page publique orpheline /badge/[id] (cassee depuis v2)`.

---

## Task 4 : Verification finale, mise a jour du plan E2E, documentation

**Files:**
- Modify: `docs/v4/plans/2026-07-20-03-v4-e2e-reorg-par-page.md`
- Modify: `docs/v4/features/politique-tests.md` (si les bugs y sont listes)
- Modify: ce plan (Progression)

- [ ] **Step 1 : Verification complete.** Run : `make lint && make typecheck && make test`. Puis suite E2E impactee :
`... yarn playwright test e2e/public/auth-register.spec.ts e2e/event/badges-print.spec.ts e2e/public/badge-public.spec.ts` — Expected : 0 echec, plus aucun `test.fixme`/`test.skip` lie a ces 3 bugs.

- [ ] **Step 2 : Mettre a jour le plan E2E** `2026-07-20-03-v4-e2e-reorg-par-page.md` :
  - Section « Bugs applicatifs connus » : marquer les 3 bugs **corriges** (renvoyer a ce plan).
  - Task 2.6 (event/badges) : retirer la mention « trancher la discrepance PRINTER » ; le PRINTER pur obtient 200 ; tester via le **nouvel endpoint** `.../badges`.
  - Task 4.3 (public/register) : retirer le `test.fixme` verify-email (golden path desormais actif).
  - Task 4.11 (public/badge-verify) : retirer le flux de telechargement `/badge/[id]` (page supprimee) ; ne conserver que `/verify/[badgeId]`.

- [ ] **Step 3 : Documenter** dans `docs/v4/features/politique-tests.md` (ou la doc pertinente) que ces 3 corrections precedent la reorganisation E2E.

- [ ] **Step 4 : Mettre a jour le tracker `## Progression`** (statuts `[x]`, dates). Conserver ce plan.

- [ ] **Step 5 : Commit** (si demande) : `docs(v4): trace corrections bugs pre-e2e + MAJ plan reorganisation`.

---

## Auto-revue (couverture)

- **verify-email** : helper `consumeEmailVerifyToken` + page directe + route deleguee + tests de-fixmes -> golden path fonctionne en conteneur. ✅
- **PRINTER** : endpoint dedie `badge.print` (DTO minimal, moindre privilege) + `withEventAuth({permission})` + routes `badges/[badgeId]` et `registrations/print` alignees + client repointe + test inverse 403->200. ✅
- **/badge/[id]** : page + composant exclusif supprimes ; test orphelin retire ; aucun import mort. ✅
- **Ordre** : ce plan precede la reorganisation E2E ; Task 4 met a jour le plan E2E (fixme/skip retires, discrepance PRINTER levee, flux badge retire). ✅
- **Securite** : pas de faux `BADGE_SCANNED` ; DTO PRINTER sans PII superflue ; durcissement `blocked` sur verify-email. ✅
- **Coherence noms** : `consumeEmailVerifyToken`/`VerifyEmailResult`, `withEventAuth({permission})`, endpoint `.../badges`, `BadgeRow`. ✅
