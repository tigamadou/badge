# Inscription publique scopée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Mise a jour 2026-05-31 — decision SMTP plateforme uniquement** : les setups `PlatformSettings` de ce plan (lignes ~825-826, 1329-1330, 1492-1493, 2164-2165, 3395-3396), qui posent tous les champs SMTP sur le singleton, **restent valides** : `PlatformSettings` conserve l'ensemble des champs SMTP en tant que source unique. Precision : le resolveur de l'expediteur ne consulte plus que `PlatformSettings.smtpFrom` ; tous les emails d'inscription, de confirmation et de rejet partent avec la **meme identite plateforme**. Le **branding contextuel** (logo de l'event, contacts org/event, libelles) reste resolu via la cascade `Event > Org > Platform` -- seul le transport SMTP et le `smtpFrom` sont figes au niveau plateforme. Aucune assertion de ce plan ne verifie un `smtpFrom` specifique a un event ; rien a corriger de ce cote.
>
> **Mise a jour 2026-05-31 — suppression d'OrgSettings** : le modele `OrgSettings` est **supprime** (fusionne dans `Organization`). Les infos contact (`contactEmail`, `contactPhone`) sont desormais lues directement depuis `Organization.contactEmail` / `Organization.contactPhone` via la cascade `Event > Organization > Platform`. **Fallback logo** : si `Event.logo` est null, utiliser `Organization.logo` (si present), puis le logo plateforme en dernier recours. Impact sur ce plan : tous les `await prisma.orgSettings.deleteMany()` (setups de test) doivent **disparaitre** ; si un test pose un contact ou un logo cote org, il ecrit directement sur `Organization` via `prisma.organization.update({ where: { id: orgId }, data: { contactEmail, contactPhone, logo } })`. `resolvePublicSettings(eventId)` (Plan 1) doit refleter cette nouvelle cascade.

**Goal:** Implement the full unauthenticated public surface of Badge v2: the contextualised registration page (`/e/[slug]`), the success page, the badge verification page (`/verify/[badgeId]`), the post-rejection edit flow (`/edit-registration/[token]`), and all backing public API routes. Every page resolves its branding, contact and reCAPTCHA settings via the cascade `Platform > Org > Event`, scopes uploads to the event, enforces blocklists and per-event registration quotas, and rate-limits public traffic.

**Architecture:** Public pages are Server Components that load the `Event` by slug, verify `archived === false && registrationOpen === true`, resolve public settings via `resolvePublicSettings(eventId)`, and hand a typed payload to a Client Component form. File uploads use a two-phase protocol: `/api/upload?context=event:[slug]` validates type/size/quota and returns a signed `uploadToken` (HMAC, TTL 1h) tied to `{eventId, kind, originalKey}`; the registration creation route consumes those tokens to materialise the files under `uploads/events/[eventId]/photos/...` and `.../idDocuments/...`. Rate-limiting is in-memory per instance (Map keyed by IP+route) — adequate for MVP, replaceable with Redis later. Edit links use single-use UUID v4 tokens stored on `Registration` with a 48h TTL, never exposed in API responses. Submissions snapshot the previous data before overwrite via `SubmissionSnapshot`. The badge verification page reuses the existing Registration record and masks identity when `Category.anonymous === true`.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), TypeScript 5, Prisma 6 (MySQL), Zod 3 (validation), react-google-recaptcha (already in v1), Vitest 4, bcryptjs (already in v1, not needed here), node:crypto (HMAC for upload tokens, UUID for edit tokens).

**Spec:** [docs/v2/features/inscription-publique.md](../../v2/features/inscription-publique.md)

**Dependencies:**

- Plan 1 (multi-tenancy & RBAC) — provides `resolveSettings`, `resolvePublicSettings`, `logActivity`, the Prisma v2 schema (Event, Category, Registration, SubmissionSnapshot, BlockedEmail, BlockedDocument), and the middleware (which does NOT match `/e/*`, `/verify/*`, `/edit-registration/*`, `/api/public/*`, `/api/upload`).
- Plan 6 (Notifications email) — provides `sendRegistrationConfirmation(registrationId)` and `sendEditLinkEmail(registrationId)`. **Hard dependency** for Tasks 5, 10, 11. If Plan 6 is not yet implemented when running Plan 5, stub these helpers with a `console.log` and a `// TODO: wired up by Plan 6` comment so Tasks 5/10/11 can still test the rest of the flow; then Plan 6 finishes the wiring.

---

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [x] | 2026-05-31 | Preflight OK : branche feat/v2-implementation, schema Prisma sync, settings.test 9/9 vert, UPLOAD_TOKEN_SECRET ajoute au .env (et .env.production.example sous Task 2). |
| 1 | [x] | 2026-05-31 | storage.ts etendu (eventPhotoKey, eventIdDocumentKey, isAllowedMime, assertWithinSizeLimit, deleteFile, safeFilename anti-traversal). 13 tests storage. Commit `eeba058`. |
| 2 | [x] | 2026-05-31 | upload-token.ts HMAC SHA256 + base64url + timingSafeEqual + validation runtime de la shape du payload. 6 tests. .env.production.example mis a jour. Commit `902c722`. |
| 3 | [x] | 2026-05-31 | rate-limit.ts in-memory IP+route, 10/min, retryAfterMs. Tests extractClientIp ajoutes. Header comment des 3 limitations MVP. 9 tests. Commit `0836371`. |
| 4 | [x] | 2026-05-31 | recaptcha.ts (skip si disabled, MISSING_TOKEN/LOW_SCORE/REJECTED/NETWORK, seuil 0.5). 5 tests. Commit `761389e`. |
| 5 | [x] | 2026-05-31 | public-event.ts : loadPublicEventBySlug + loadEventByIdForVerify + PublicEventError. 6 tests. **Non commit** (regle no-implicit-commits depuis Task 5). |
| 6 | [x] | 2026-05-31 | validators/registration.ts : Zod publicRegistrationSchema + editRegistrationSchema + ID_DOC_TYPES. Migration vers `.pipe(z.email(...))` (Zod 4). 8 tests. Non commit. |
| 7 | [x] | 2026-05-31 | /api/upload rewrite public scope event:<slug>, mime/size/quota/token. 7 tests + afterEach cleanup uploads/events. Brise l'ancien caller v1 edit-registration (Task 16 le remplace). Non commit. |
| 8 | [x] | 2026-05-31 | GET /api/public/events/[slug] (event + categories + public settings). 3 tests. Non commit. |
| 9 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 10 | [x] | 2026-05-31 | GET /api/public/verify/[badgeId] + page /verify/[badgeId] + composant BadgeVerifyView. Masque identite si Category.anonymous. Log BADGE_SCANNED. 5 tests. Non commit. |
| 11 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 12 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 13 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 14 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 15 | [x] | 2026-05-31 | Page /e/[slug] + /e/[slug]/success. Bug-fix plan : recaptcha via `getPlatformPublicRecaptcha()` (pas via resolvePublicSettings). Refactor try/catch JSX en helper tagge pour satisfaire ESLint react-hooks/error-boundaries. Non commit. |
| 16 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 17 | [-] | 2026-06-01 | supersede par v2-11 (comptes participants) -- artefact non livre, remplace par flux authentifie. Voir audit v2-14 §2.5. |
| 18 | [x] | 2026-05-31 | docs/v2/api/public.md cree (205 lignes), docs/v2/architecture.md section "Etat au lot D" ajoutee, docs/v2/features/inscription-publique.md avec note Statut. Non commit. |
| 19 | [x] | 2026-05-31 | Verification finale : 483/483 tests verts (52 fichiers, +83 nouveaux Plan v2-05), make lint 0 erreurs, make typecheck 0 erreurs. Step 19.3 (smoke navigateur) reporte a l'utilisateur. |

**Derniere session** : 2026-05-31 - Plan v2-05 entierement implemente (Tasks 0-19 = [x]). Execution via subagent-driven-development sequentiel (skill officielle), avec spec-review + code-quality-review sur les tasks critiques (1, 2, 3, 5). **Commits arretes a partir de Task 5** suite a la regle projet : un agent ne commit que sur demande explicite utilisateur. Tasks 0-4 commitees (4 commits : `eeba058`, `902c722`, `0836371`, `761389e`). Tasks 5-19 stagees mais NON commitees, en attente de la decision de l'utilisateur sur le decoupage des commits.

Fixes/decisions livrees pendant Plan v2-05 :
- `src/lib/mail.ts` : stub `sendRegistrationConfirmation` ajoute (Task 9). Les autres stubs (`sendStatusNotification`, `sendBadgePrintedNotification`, `sendEditLinkEmail`) existaient deja depuis Plan v2-04.
- `.env.production.example` : `UPLOAD_TOKEN_SECRET` documente avec hint `openssl rand -base64 32`.
- Bug du plan corrige (Tasks 9, 11, 15, 16) : recaptcha doit etre lu via `getPlatformPublicRecaptcha()` / `getPlatformRecaptcha()` et non via `resolvePublicSettings()` qui ne contient que `{contactEmail, contactPhone}`.
- Bug du plan corrige (Task 9) : la regex du badge ID etait `\d{12}` dans le plan, en realite 13 caracteres (1+6+2+1+3).
- Test cooldown pollution (Task 12) : ajout d'un `resetEditResendCooldownForTests()` exporte pour reset le Map module-level entre tests.

**Prochaine etape** : commit (sur demande utilisateur — decoupage possible : un commit par lot logique helpers/API/UI/docs, ou un commit unique "Plan v2-05"). Smoke navigateur (Step 19.3) a executer en local. Puis Plan v2-06 (vraies notifications email, remplace les stubs).

**Note 2026-05-31** : suppression d'`OrgSettings` (fusionne dans `Organization`). Contact lu directement depuis `Organization.contactEmail`/`Organization.contactPhone` via la cascade `Event > Organization > Platform`. Fallback logo : `Event.logo` -> `Organization.logo` -> logo plateforme. Tous les setups de test `prisma.orgSettings.deleteMany()` / `prisma.orgSettings.create(...)` disparaissent ; tout contact ou logo cote org est pose via `prisma.organization.update`.

---

## File Structure

**Files to create:**

- `src/lib/upload-token.ts` (HMAC-signed upload tokens)
- `src/lib/rate-limit.ts` (in-memory IP rate limiter)
- `src/lib/recaptcha.ts` (server-side verification)
- `src/lib/public-event.ts` (loadPublicEvent helper + guards)
- `src/lib/__tests__/storage.test.ts` (new — event-scoped paths)
- `src/lib/__tests__/upload-token.test.ts`
- `src/lib/__tests__/rate-limit.test.ts`
- `src/lib/__tests__/recaptcha.test.ts`
- `src/lib/__tests__/public-event.test.ts`
- `src/app/api/upload/route.ts` (rewrite — public scope event:[slug])
- `src/app/api/public/events/[slug]/route.ts`
- `src/app/api/public/events/[slug]/registrations/route.ts`
- `src/app/api/public/verify/[badgeId]/route.ts`
- `src/app/api/public/edit-registration/[token]/route.ts`
- `src/app/api/public/edit-registration/[token]/resend/route.ts`
- `src/app/api/__tests__/public-registrations.test.ts` (integration)
- `src/app/api/__tests__/public-verify.test.ts`
- `src/app/api/__tests__/public-edit.test.ts`
- `src/app/e/[slug]/page.tsx`
- `src/app/e/[slug]/success/page.tsx`
- `src/app/e/[slug]/closed.tsx` (small UI helper, server)
- `src/app/verify/[badgeId]/page.tsx`
- `src/app/edit-registration/[token]/page.tsx`
- `src/app/edit-registration/expired/page.tsx`
- `src/components/public/PublicEventLayout.tsx`
- `src/components/public/PublicRegistrationForm.tsx`
- `src/components/public/EditRegistrationForm.tsx`
- `src/components/public/BadgeVerifyView.tsx`
- `src/components/public/FileUploadField.tsx`
- `src/lib/validators/registration.ts` (Zod schema partagé)
- `src/lib/__tests__/registration-validator.test.ts`

**Files to modify:**

- `src/lib/storage.ts` (extend with helpers `eventPhotoKey`, `eventIdDocumentKey`, validation)
- `src/lib/generate-id.ts` (no change — reused as-is)

**Tests live in `src/lib/__tests__/` and `src/app/api/__tests__/` (existing convention).**

---

## Pre-flight

### Task 0: Confirm Plan 1 is in place and DB is clean

- [ ] **Step 0.1: Check branch and Plan 1 artefacts**

```bash
git status && git branch --show-current
ls src/lib/settings.ts src/lib/auth-guards.ts src/lib/user-context.ts src/lib/activity-log.ts
```

Expected: branch `feat/v2-sass`, no uncommitted changes (or only this plan). All four files exist.

- [ ] **Step 0.2: Verify Prisma schema v2 is applied**

```bash
docker compose -f docker-compose.dev.yml exec app yarn prisma db push --accept-data-loss
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/settings.test.ts
```

Expected: schema in sync, settings tests pass (sanity-check that Plan 1 is wired up).

- [ ] **Step 0.3: Confirm `UPLOAD_TOKEN_SECRET` is defined**

The upload token signing requires a secret. Add it to `.env` if absent:

```bash
grep -q "^UPLOAD_TOKEN_SECRET=" .env || echo "UPLOAD_TOKEN_SECRET=dev-upload-secret-change-me" >> .env
```

Expected: variable present. In production `.env.production` it MUST be a 32+ byte random string.

---

## Task 1: Storage v2 — event-scoped paths

**Files:**
- Modify: `src/lib/storage.ts` (extend, do not break existing signature)
- Create: `src/lib/__tests__/storage.test.ts`

**Spec reference:** Master design § "Stockage de fichiers" + inscription-publique § "Upload sécurisé".

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/__tests__/storage.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  eventPhotoKey,
  eventIdDocumentKey,
  uploadFile,
  getFile,
  deleteFile,
  ALLOWED_IMAGE_MIME,
  ALLOWED_DOCUMENT_MIME,
  MAX_UPLOAD_BYTES,
  isAllowedMime,
  assertWithinSizeLimit,
} from "@/lib/storage";

const UPLOADS = path.join(process.cwd(), "uploads");

afterEach(async () => {
  // best-effort cleanup
  await fs.rm(path.join(UPLOADS, "events", "evt-test"), { recursive: true, force: true });
});

describe("storage path helpers", () => {
  it("eventPhotoKey returns events/<eventId>/photos/<filename>", () => {
    const k = eventPhotoKey("evt-test", "abc.jpg");
    expect(k).toBe("events/evt-test/photos/abc.jpg");
  });

  it("eventIdDocumentKey returns events/<eventId>/idDocuments/<filename>", () => {
    const k = eventIdDocumentKey("evt-test", "doc.pdf");
    expect(k).toBe("events/evt-test/idDocuments/doc.pdf");
  });

  it("uploadFile creates the directory and writes the file", async () => {
    const key = eventPhotoKey("evt-test", "x.png");
    await uploadFile(key, Buffer.from("hello"), "image/png");
    const r = await getFile(key);
    expect(r.body.toString()).toBe("hello");
    expect(r.contentType).toBe("image/png");
  });

  it("deleteFile removes the file (no-op if missing)", async () => {
    const key = eventPhotoKey("evt-test", "y.png");
    await uploadFile(key, Buffer.from("y"), "image/png");
    await deleteFile(key);
    await expect(getFile(key)).rejects.toThrow();
    await expect(deleteFile(key)).resolves.toBeUndefined();
  });
});

describe("mime + size validation", () => {
  it("accepts JPEG/PNG/WebP for photos", () => {
    expect(isAllowedMime("image/jpeg", "photo")).toBe(true);
    expect(isAllowedMime("image/png", "photo")).toBe(true);
    expect(isAllowedMime("image/webp", "photo")).toBe(true);
  });
  it("rejects PDF for photos", () => {
    expect(isAllowedMime("application/pdf", "photo")).toBe(false);
  });
  it("accepts JPEG/PNG/WebP/PDF for documents", () => {
    for (const m of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(isAllowedMime(m, "document")).toBe(true);
    }
  });
  it("rejects unknown types", () => {
    expect(isAllowedMime("text/plain", "photo")).toBe(false);
    expect(isAllowedMime("application/zip", "document")).toBe(false);
  });
  it("assertWithinSizeLimit throws for files larger than 5 MB", () => {
    expect(() => assertWithinSizeLimit(MAX_UPLOAD_BYTES + 1)).toThrow(/TOO_LARGE/);
  });
  it("assertWithinSizeLimit passes at limit", () => {
    expect(() => assertWithinSizeLimit(MAX_UPLOAD_BYTES)).not.toThrow();
  });
});

describe("path safety", () => {
  it("rejects path traversal in filename", () => {
    expect(() => eventPhotoKey("evt-test", "../../etc/passwd")).toThrow();
    expect(() => eventIdDocumentKey("evt-test", "..\\evil")).toThrow();
  });
  it("rejects empty / absolute filenames", () => {
    expect(() => eventPhotoKey("evt-test", "")).toThrow();
    expect(() => eventPhotoKey("evt-test", "/abs")).toThrow();
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/storage.test.ts
```

Expected: FAIL — helpers do not exist yet.

- [ ] **Step 1.3: Rewrite `src/lib/storage.ts`**

```typescript
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_DOCUMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type UploadKind = "photo" | "document";

export function isAllowedMime(mime: string, kind: UploadKind): boolean {
  if (kind === "photo") return ALLOWED_IMAGE_MIME.has(mime);
  return ALLOWED_DOCUMENT_MIME.has(mime);
}

export function assertWithinSizeLimit(bytes: number): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error("TOO_LARGE");
  }
}

function safeFilename(name: string): string {
  if (!name || name.startsWith("/") || name.includes("..") || name.includes("\\")) {
    throw new Error("INVALID_FILENAME");
  }
  // collapse any subpath: only basename allowed
  const base = path.basename(name);
  if (!base || base !== name) {
    throw new Error("INVALID_FILENAME");
  }
  return base;
}

export function eventPhotoKey(eventId: string, filename: string): string {
  return `events/${eventId}/photos/${safeFilename(filename)}`;
}

export function eventIdDocumentKey(eventId: string, filename: string): string {
  return `events/${eventId}/idDocuments/${safeFilename(filename)}`;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function uploadFile(
  key: string,
  body: Buffer,
  _contentType: string,
): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body);
  return key;
}

export async function getFile(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const filePath = path.join(UPLOADS_DIR, key);
  const body = await fs.readFile(filePath);

  const ext = path.extname(key).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };

  return {
    body,
    contentType: mimeTypes[ext] || "application/octet-stream",
  };
}

export async function deleteFile(key: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, key);
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/storage.test.ts
```

Expected: 14 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(v2): storage scope event (chemins, mime, taille, helpers)"
```

---

## Task 2: Upload token (HMAC-signed, TTL 1h)

**Files:**
- Create: `src/lib/upload-token.ts`
- Create: `src/lib/__tests__/upload-token.test.ts`

**Why:** the participant has no auth. We allow them to upload first, get back an opaque token, and then call the registration endpoint with that token. The signed token binds `(eventId, kind, storageKey)` so a malicious client cannot swap files between events or kinds.

- [ ] **Step 2.1: Write failing tests**

Create `src/lib/__tests__/upload-token.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import {
  signUploadToken,
  verifyUploadToken,
  UploadTokenError,
} from "@/lib/upload-token";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

describe("upload-token", () => {
  it("round-trips a valid payload", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "photo",
      storageKey: "events/evt1/photos/a.jpg",
    });
    const payload = verifyUploadToken(token);
    expect(payload.eventId).toBe("evt1");
    expect(payload.kind).toBe("photo");
    expect(payload.storageKey).toBe("events/evt1/photos/a.jpg");
  });

  it("rejects a token with a tampered payload", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "photo",
      storageKey: "events/evt1/photos/a.jpg",
    });
    const [pay, sig] = token.split(".");
    // mutate the payload but keep the signature
    const mutated = Buffer.from(pay, "base64url").toString("utf8").replace("evt1", "evt2");
    const newPay = Buffer.from(mutated).toString("base64url");
    expect(() => verifyUploadToken(`${newPay}.${sig}`)).toThrow(UploadTokenError);
  });

  it("rejects an expired token", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = signUploadToken(
      { eventId: "evt1", kind: "photo", storageKey: "k" },
      { issuedAt: past, ttlSeconds: 5 },
    );
    expect(() => verifyUploadToken(token)).toThrow(/EXPIRED/);
  });

  it("rejects a malformed token (no dot)", () => {
    expect(() => verifyUploadToken("nonsense")).toThrow(UploadTokenError);
  });

  it("default TTL is 3600 seconds", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "document",
      storageKey: "events/evt1/idDocuments/x.pdf",
    });
    const payload = verifyUploadToken(token);
    expect(payload.exp - payload.iat).toBe(3600);
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/upload-token.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 2.3: Implement `src/lib/upload-token.ts`**

```typescript
import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 3600;

export class UploadTokenError extends Error {
  constructor(public code: "INVALID" | "EXPIRED" | "MALFORMED", message?: string) {
    super(message ?? code);
  }
}

export type UploadTokenKind = "photo" | "document";

export type UploadTokenPayload = {
  eventId: string;
  kind: UploadTokenKind;
  storageKey: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const s = process.env.UPLOAD_TOKEN_SECRET;
  if (!s) throw new Error("UPLOAD_TOKEN_SECRET is not defined");
  return s;
}

function b64urlEncode(b: Buffer | string): string {
  return Buffer.from(b).toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signUploadToken(
  input: { eventId: string; kind: UploadTokenKind; storageKey: string },
  opts?: { issuedAt?: number; ttlSeconds?: number },
): string {
  const iat = opts?.issuedAt ?? Math.floor(Date.now() / 1000);
  const exp = iat + (opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: UploadTokenPayload = { ...input, iat, exp };
  const payloadStr = b64urlEncode(JSON.stringify(payload));
  const sig = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2) throw new UploadTokenError("MALFORMED");
  const [payloadStr, sig] = parts;
  const expected = sign(payloadStr);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UploadTokenError("INVALID");
  }
  let payload: UploadTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadStr).toString("utf8"));
  } catch {
    throw new UploadTokenError("MALFORMED");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new UploadTokenError("EXPIRED");
  return payload;
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/upload-token.test.ts
```

Expected: 5 passed.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/upload-token.ts src/lib/__tests__/upload-token.test.ts
git commit -m "feat(v2): upload-token signe HMAC court-vivant pour uploads publics"
```

---

## Task 3: Rate limit in-memory (Map keyed by IP+route)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/__tests__/rate-limit.test.ts`

**Spec :** 10 requêtes/minute par IP par route. Window = 60s, max = 10. Pas de Redis pour MVP.

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/__tests__/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  resetRateLimitForTests,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.useFakeTimers();
  });

  it("allows up to N requests in the window", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) {
      expect(checkRateLimit("1.1.1.1", "route-a").ok).toBe(true);
    }
    expect(checkRateLimit("1.1.1.1", "route-a").ok).toBe(false);
  });

  it("isolates by IP", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    expect(checkRateLimit("b", "r").ok).toBe(true);
  });

  it("isolates by route", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r1");
    expect(checkRateLimit("a", "r2").ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    expect(checkRateLimit("a", "r").ok).toBe(false);
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS + 1);
    expect(checkRateLimit("a", "r").ok).toBe(true);
  });

  it("returns retryAfterMs in the failure result", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    const r = checkRateLimit("a", "r");
    expect(r.ok).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(DEFAULT_WINDOW_MS);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/rate-limit.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3.3: Implement `src/lib/rate-limit.ts`**

```typescript
export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  ip: string,
  route: string,
  opts?: { windowMs?: number; max?: number },
): RateLimitResult {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts?.max ?? DEFAULT_MAX;
  const key = `${ip}|${route}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterMs: Math.max(1, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count };
}

export function extractClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/rate-limit.test.ts
```

Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/__tests__/rate-limit.test.ts
git commit -m "feat(v2): rate-limit in-memory IP+route (10/min)"
```

---

## Task 4: reCAPTCHA v3 server-side verifier

**Files:**
- Create: `src/lib/recaptcha.ts`
- Create: `src/lib/__tests__/recaptcha.test.ts`

The site key is exposed in the public settings; the secret stays server-side. When `resolveSettings(eventId).recaptchaEnabled === false`, we skip verification entirely.

- [ ] **Step 4.1: Write failing tests**

Create `src/lib/__tests__/recaptcha.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRecaptcha } from "@/lib/recaptcha";

const originalFetch = global.fetch;

describe("verifyRecaptcha", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns ok=true when disabled (no secret)", async () => {
    const r = await verifyRecaptcha({ enabled: false, secretKey: "", token: "anything" });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false when enabled and token is missing", async () => {
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("MISSING_TOKEN");
  });

  it("calls Google and returns ok=true on score >= 0.5", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: true, score: 0.7 }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false when score < 0.5", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: true, score: 0.3 }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("LOW_SCORE");
  });

  it("returns ok=false when google says success=false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("REJECTED");
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/recaptcha.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 4.3: Implement `src/lib/recaptcha.ts`**

```typescript
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const MIN_SCORE = 0.5;

export type RecaptchaResult =
  | { ok: true; score?: number }
  | { ok: false; code: "MISSING_TOKEN" | "LOW_SCORE" | "REJECTED" | "NETWORK"; details?: unknown };

export async function verifyRecaptcha(input: {
  enabled: boolean;
  secretKey: string;
  token: string;
  remoteIp?: string;
}): Promise<RecaptchaResult> {
  if (!input.enabled) return { ok: true };
  if (!input.token) return { ok: false, code: "MISSING_TOKEN" };

  try {
    const body = new URLSearchParams({ secret: input.secretKey, response: input.token });
    if (input.remoteIp) body.set("remoteip", input.remoteIp);
    const resp = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await resp.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
    if (!data.success) return { ok: false, code: "REJECTED", details: data["error-codes"] };
    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      return { ok: false, code: "LOW_SCORE", details: { score: data.score } };
    }
    return { ok: true, score: data.score };
  } catch (err) {
    return { ok: false, code: "NETWORK", details: String(err) };
  }
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/recaptcha.test.ts
```

Expected: 5 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/recaptcha.ts src/lib/__tests__/recaptcha.test.ts
git commit -m "feat(v2): verification reCAPTCHA v3 (skip si desactive, seuil 0.5)"
```

---

## Task 5: Public event loader + guards

**Files:**
- Create: `src/lib/public-event.ts`
- Create: `src/lib/__tests__/public-event.test.ts`

A small helper used by both the public API and pages: load an Event by slug, throw a typed error if it's archived or registrations are closed. Also returns `Category[]` and `PublicSettings`.

- [ ] **Step 5.1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  loadPublicEventBySlug,
  PublicEventError,
} from "@/lib/public-event";

describe("loadPublicEventBySlug", () => {
  beforeEach(async () => {
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "p", smtpPort: 587, smtpFrom: "p@x",
        smtpUser: "", smtpPassword: "", smtpSecure: false,
        recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
      },
    });
  });

  it("throws NOT_FOUND when slug unknown", async () => {
    await expect(loadPublicEventBySlug("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws CLOSED when registrationOpen=false", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "s1", location: "", date: new Date(), registrationOpen: false },
    });
    await expect(loadPublicEventBySlug("s1")).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("throws CLOSED when archived=true even if open", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "s2", location: "", date: new Date(), registrationOpen: true, archived: true },
    });
    await expect(loadPublicEventBySlug("s2")).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("returns event + categories + public settings when open", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o3" } });
    const ev = await prisma.event.create({
      data: {
        orgId: org.id, title: "Event 3", slug: "s3", location: "Loc", date: new Date(),
        registrationOpen: true,
      },
    });
    await prisma.category.create({
      data: { eventId: ev.id, name: "Press", color: "#fff", number: 10 },
    });
    const r = await loadPublicEventBySlug("s3");
    expect(r.event.id).toBe(ev.id);
    expect(r.categories).toHaveLength(1);
    expect(r.settings).toBeDefined();
    expect("smtpPassword" in r.settings).toBe(false);
    expect("recaptchaSecretKey" in r.settings).toBe(false);
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/public-event.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 5.3: Implement `src/lib/public-event.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import type { Event, Category, Organization } from "@prisma/client";
import type { PublicSettings } from "@/lib/settings";

export class PublicEventError extends Error {
  constructor(public code: "NOT_FOUND" | "CLOSED", message?: string) {
    super(message ?? code);
  }
}

export type PublicEventBundle = {
  event: Event & { organization: Pick<Organization, "id" | "name" | "slug"> };
  categories: Category[];
  settings: PublicSettings;
};

export async function loadPublicEventBySlug(slug: string): Promise<PublicEventBundle> {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!event) throw new PublicEventError("NOT_FOUND");
  if (event.archived || !event.registrationOpen) throw new PublicEventError("CLOSED");

  const categories = await prisma.category.findMany({
    where: { eventId: event.id },
    orderBy: { number: "asc" },
  });

  const settings = await resolvePublicSettings(event.id);

  return { event, categories, settings };
}

export async function loadEventByIdForVerify(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, date: true, slug: true, archived: true },
  });
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/public-event.test.ts
```

Expected: 4 passed.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/public-event.ts src/lib/__tests__/public-event.test.ts
git commit -m "feat(v2): loadPublicEventBySlug (event + categories + settings publics)"
```

---

## Task 6: Zod validator for registration payload

**Files:**
- Create: `src/lib/validators/registration.ts`
- Create: `src/lib/__tests__/registration-validator.test.ts`

Shared schema used by `POST /api/public/events/[slug]/registrations` and `POST /api/public/edit-registration/[token]`. Centralised so client and server agree on rules.

- [ ] **Step 6.1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  publicRegistrationSchema,
  editRegistrationSchema,
  ID_DOC_TYPES,
} from "@/lib/validators/registration";

const valid = {
  email: "a@b.co",
  firstName: "Alice",
  lastName: "Doe",
  structure: "Acme",
  categoryId: "cat1",
  idDocumentType: "CNI",
  idDocumentNumber: "ABC123",
  photoToken: "p.tok",
  idDocumentToken: "d.tok",
  recaptchaToken: "",
};

describe("publicRegistrationSchema", () => {
  it("accepts a valid payload", () => {
    const r = publicRegistrationSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
  it("rejects invalid email", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, email: "no" });
    expect(r.success).toBe(false);
  });
  it("rejects empty firstName", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, firstName: "" });
    expect(r.success).toBe(false);
  });
  it("rejects unknown idDocumentType", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, idDocumentType: "FOO" });
    expect(r.success).toBe(false);
  });
  it("requires photoToken and idDocumentToken", () => {
    expect(publicRegistrationSchema.safeParse({ ...valid, photoToken: "" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...valid, idDocumentToken: "" }).success).toBe(false);
  });
  it("trims and lowercases email", () => {
    const r = publicRegistrationSchema.parse({ ...valid, email: "  A@B.CO " });
    expect(r.email).toBe("a@b.co");
  });
});

describe("editRegistrationSchema", () => {
  it("makes photoToken and idDocumentToken optional", () => {
    const { photoToken, idDocumentToken, ...rest } = valid;
    expect(editRegistrationSchema.safeParse(rest).success).toBe(true);
  });
});

describe("ID_DOC_TYPES", () => {
  it("exposes the canonical list", () => {
    expect(ID_DOC_TYPES).toContain("CNI");
    expect(ID_DOC_TYPES).toContain("Passeport");
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-validator.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 6.3: Implement `src/lib/validators/registration.ts`**

```typescript
import { z } from "zod";

export const ID_DOC_TYPES = [
  "CNI",
  "Passeport",
  "Permis de conduire",
  "Carte de séjour",
] as const;

const baseFields = {
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email invalide"),
  firstName: z.string().trim().min(1, "Prénom requis").max(120),
  lastName: z.string().trim().min(1, "Nom requis").max(120),
  structure: z.string().trim().min(1, "Structure requise").max(200),
  categoryId: z.string().min(1, "Catégorie requise"),
  idDocumentType: z.enum(ID_DOC_TYPES, { message: "Type de pièce inconnu" }),
  idDocumentNumber: z.string().trim().min(1, "Numéro requis").max(60),
  recaptchaToken: z.string().optional().default(""),
};

export const publicRegistrationSchema = z.object({
  ...baseFields,
  photoToken: z.string().min(1, "Photo requise"),
  idDocumentToken: z.string().min(1, "Document requis"),
});

export const editRegistrationSchema = z.object({
  ...baseFields,
  photoToken: z.string().optional().default(""),
  idDocumentToken: z.string().optional().default(""),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
export type EditRegistrationInput = z.infer<typeof editRegistrationSchema>;
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-validator.test.ts
```

Expected: 9 passed.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/validators/registration.ts src/lib/__tests__/registration-validator.test.ts
git commit -m "feat(v2): validateurs Zod inscription publique + edition"
```

---

## Task 7: Upload route — `POST /api/upload?context=event:[slug]`

**Files:**
- Modify: `src/app/api/upload/route.ts` (rewrite)
- Create: `src/app/api/__tests__/upload.test.ts`

**Contract:**
- Query: `?context=event:<slug>&kind=photo|document`
- Body: multipart/form-data with field `file`
- Verifies event is open, mime allowed, size ≤ 5 Mo
- Writes the file to disk under a UUID filename
- Returns `{ token: "<signed>", originalName, kind, size }`

- [ ] **Step 7.1: Write failing tests**

Create `src/app/api/__tests__/upload.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/upload/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
});

async function setupOpenEvent(slug = "evt-up") {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${slug}` } });
  return prisma.event.create({
    data: { orgId: org.id, title: "E", slug, location: "", date: new Date(), registrationOpen: true },
  });
}

function makeReq(slug: string, kind: "photo" | "document", file: { name: string; type: string; bytes: Buffer }) {
  const fd = new FormData();
  fd.append("file", new Blob([file.bytes], { type: file.type }), file.name);
  return new Request(`http://test/api/upload?context=event:${slug}&kind=${kind}`, {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/upload", () => {
  it("accepts a valid JPEG for photo", async () => {
    const ev = await setupOpenEvent();
    const req = makeReq(ev.slug, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("xxx") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toMatch(/\./);
    expect(json.kind).toBe("photo");
  });

  it("returns 404 for unknown slug", async () => {
    const req = makeReq("nope", "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(404);
  });

  it("returns 403 if event is closed", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "c1" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evtc", location: "", date: new Date(), registrationOpen: false },
    });
    const req = makeReq(ev.slug, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(403);
  });

  it("returns 415 for disallowed mime", async () => {
    const ev = await setupOpenEvent("u2");
    const req = makeReq(ev.slug, "photo", { name: "p.txt", type: "text/plain", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(415);
  });

  it("returns 413 for files > 5 Mo", async () => {
    const ev = await setupOpenEvent("u3");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const req = makeReq(ev.slug, "photo", { name: "big.jpg", type: "image/jpeg", bytes: big });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(413);
  });

  it("accepts PDF for document kind", async () => {
    const ev = await setupOpenEvent("u4");
    const req = makeReq(ev.slug, "document", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
  });

  it("rejects PDF when kind=photo", async () => {
    const ev = await setupOpenEvent("u5");
    const req = makeReq(ev.slug, "photo", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(415);
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/upload.test.ts
```

Expected: FAIL.

- [ ] **Step 7.3: Implement `src/app/api/upload/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  isAllowedMime,
  assertWithinSizeLimit,
  uploadFile,
  eventPhotoKey,
  eventIdDocumentKey,
  MAX_UPLOAD_BYTES,
  type UploadKind,
} from "@/lib/storage";
import { signUploadToken } from "@/lib/upload-token";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function parseContext(ctx: string | null): { slug: string } | null {
  if (!ctx) return null;
  const m = ctx.match(/^event:(.+)$/);
  return m ? { slug: m[1] } : null;
}

function parseKind(k: string | null): UploadKind | null {
  return k === "photo" || k === "document" ? k : null;
}

function extOf(name: string, fallback: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : fallback;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const ctx = parseContext(url.searchParams.get("context"));
  const kind = parseKind(url.searchParams.get("kind"));
  if (!ctx || !kind) {
    return NextResponse.json({ error: "Bad request", code: "BAD_CONTEXT" }, { status: 400 });
  }

  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "upload");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes", code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const event = await prisma.event.findUnique({ where: { slug: ctx.slug } });
  if (!event) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (event.archived || !event.registrationOpen) {
    return NextResponse.json({ error: "Inscriptions fermées", code: "CLOSED" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime, kind)) {
    return NextResponse.json({ error: "Type interdit", code: "BAD_TYPE" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (5 Mo max)", code: "TOO_LARGE" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  assertWithinSizeLimit(buffer.length);

  const origName = file instanceof File ? file.name : "upload";
  const ext = extOf(origName, mime === "application/pdf" ? ".pdf" : ".bin");
  const filename = `${randomUUID()}${ext}`;
  const storageKey = kind === "photo"
    ? eventPhotoKey(event.id, filename)
    : eventIdDocumentKey(event.id, filename);

  await uploadFile(storageKey, buffer, mime);

  const token = signUploadToken({ eventId: event.id, kind, storageKey });
  return NextResponse.json({ token, originalName: origName, kind, size: buffer.length });
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/upload.test.ts
```

Expected: 7 passed.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/api/upload/route.ts src/app/api/__tests__/upload.test.ts
git commit -m "feat(v2): /api/upload public scope event (token signe, mime, taille)"
```

---

## Task 8: Public event GET — `GET /api/public/events/[slug]`

**Files:**
- Create: `src/app/api/public/events/[slug]/route.ts`
- Create: `src/app/api/__tests__/public-event.test.ts`

Returns the data needed by the form (event meta + categories + public settings). Read-only, lightly rate-limited.

- [ ] **Step 8.1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/public/events/[slug]/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "p", smtpPort: 587, smtpFrom: "p@x",
      smtpUser: "", smtpPassword: "", smtpSecure: false,
      recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
    },
  });
});

describe("GET /api/public/events/[slug]", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when registrations closed", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o1" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ev1", location: "", date: new Date(), registrationOpen: false },
    });
    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "ev1" }) });
    expect(res.status).toBe(403);
  });

  it("returns event + categories + public settings", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E2", slug: "ev2", location: "L", date: new Date(), registrationOpen: true },
    });
    await prisma.category.create({ data: { eventId: ev.id, name: "C1", color: "#fff", number: 1 } });

    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "ev2" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.event.title).toBe("E2");
    expect(json.categories).toHaveLength(1);
    expect("smtpPassword" in json.settings).toBe(false);
    expect("recaptchaSecretKey" in json.settings).toBe(false);
  });
});
```

- [ ] **Step 8.2: Run to verify failure**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-event.test.ts
```

Expected: FAIL.

- [ ] **Step 8.3: Implement `src/app/api/public/events/[slug]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-event-get");
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limited", code: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const { event, categories, settings } = await loadPublicEventBySlug(slug);
    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        location: event.location,
        date: event.date,
        logo: event.logo,
        organization: event.organization,
      },
      categories: categories.map((c) => ({
        id: c.id, name: c.name, color: c.color, number: c.number, anonymous: c.anonymous,
      })),
      settings,
    });
  } catch (err) {
    if (err instanceof PublicEventError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.code, code: err.code }, { status });
    }
    throw err;
  }
}
```

- [ ] **Step 8.4: Run tests to verify pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-event.test.ts
```

Expected: 3 passed.

- [ ] **Step 8.5: Commit**

```bash
git add src/app/api/public/events/[slug]/route.ts src/app/api/__tests__/public-event.test.ts
git commit -m "feat(v2): GET /api/public/events/[slug] (event + categories + settings)"
```

---

## Task 9: Public registration creation — `POST /api/public/events/[slug]/registrations`

**Files:**
- Create: `src/app/api/public/events/[slug]/registrations/route.ts`
- Create: `src/app/api/__tests__/public-registrations.test.ts`

**Flow:**
1. Rate limit by IP.
2. Load event via `loadPublicEventBySlug`.
3. Validate body with `publicRegistrationSchema`.
4. Resolve `ResolvedSettings` (with secret) — used for reCAPTCHA verification.
5. Verify reCAPTCHA if enabled.
6. Check `BlockedEmail` (eventId + email) → 409 EMAIL_BLOCKED.
7. Check `BlockedDocument` (eventId + idDocumentNumber) → 409 DOCUMENT_BLOCKED.
8. Check quota : count registrations of the org (across all events in the org) ≤ `organization.quotaMaxRegistrations`. 429 QUOTA_EXCEEDED if exceeded.
9. Verify both upload tokens (eventId match, kind match).
10. Compute badge ID with `generateId` (using `categoryNumber` + `event.date` + sequential count).
11. Create the Registration in a transaction; if it succeeds we keep the files (already on disk).
12. `logActivity({ type: REGISTRATION_CREATED, eventId, targetId, req })`.
13. Dispatch `sendRegistrationConfirmation(registrationId)` (best-effort, do not fail the request if mail fails).
14. Return `{ id: registration.id }`.

- [ ] **Step 9.1: Write failing tests**

Create `src/app/api/__tests__/public-registrations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/public/events/[slug]/registrations/route";
import { signUploadToken } from "@/lib/upload-token";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { eventPhotoKey, eventIdDocumentKey, uploadFile } from "@/lib/storage";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

async function setup({
  open = true,
  quota = null as number | null,
  recaptcha = false,
} = {}) {
  await prisma.activityLog.deleteMany();
  await prisma.submissionSnapshot.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton", smtpHost: "", smtpPort: 587, smtpFrom: "noreply@x",
      smtpUser: "", smtpPassword: "", smtpSecure: false,
      recaptchaEnabled: recaptcha, recaptchaSiteKey: "site", recaptchaSecretKey: "sec",
    },
  });
  const org = await prisma.organization.create({
    data: { name: "O", slug: `o-${Date.now()}`, quotaMaxRegistrations: quota },
  });
  const ev = await prisma.event.create({
    data: {
      orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L",
      date: new Date("2026-06-01"), registrationOpen: open,
    },
  });
  const cat = await prisma.category.create({
    data: { eventId: ev.id, name: "Cat A", color: "#fff", number: 11 },
  });

  // Create on-disk files so the tokens point to something real.
  const photoKey = eventPhotoKey(ev.id, "photo.jpg");
  const docKey = eventIdDocumentKey(ev.id, "doc.pdf");
  await uploadFile(photoKey, Buffer.from("p"), "image/jpeg");
  await uploadFile(docKey, Buffer.from("d"), "application/pdf");

  return {
    org, ev, cat,
    photoToken: signUploadToken({ eventId: ev.id, kind: "photo", storageKey: photoKey }),
    documentToken: signUploadToken({ eventId: ev.id, kind: "document", storageKey: docKey }),
  };
}

function body(over: Record<string, unknown> = {}, fixture: Awaited<ReturnType<typeof setup>>) {
  return {
    email: "alice@x.co",
    firstName: "Alice",
    lastName: "Doe",
    structure: "Acme",
    categoryId: fixture.cat.id,
    idDocumentType: "CNI",
    idDocumentNumber: "ABC123",
    photoToken: fixture.photoToken,
    idDocumentToken: fixture.documentToken,
    recaptchaToken: "",
    ...over,
  };
}

function req(slug: string, payload: unknown) {
  return new Request(`http://test/api/public/events/${slug}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(payload),
  });
}

beforeEach(resetRateLimitForTests);

describe("POST /api/public/events/[slug]/registrations", () => {
  it("creates a registration with PENDING status and logs activity", async () => {
    const f = await setup();
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, {
      params: Promise.resolve({ slug: f.ev.slug }),
    });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const reg = await prisma.registration.findUnique({ where: { id } });
    expect(reg?.status).toBe("PENDING");
    expect(reg?.eventId).toBe(f.ev.id);
    expect(reg?.id).toMatch(/^\d{12}$/);
    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_CREATED" } });
    expect(log?.eventId).toBe(f.ev.id);
    expect(log?.orgId).toBe(f.org.id);
  });

  it("returns 404 for unknown slug", async () => {
    const res = await POST(req("nope", {}) as unknown as Request, { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 if event closed", async () => {
    const f = await setup({ open: false });
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid payload", async () => {
    const f = await setup();
    const res = await POST(req(f.ev.slug, body({ email: "bad" }, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(400);
  });

  it("returns 409 EMAIL_BLOCKED", async () => {
    const f = await setup();
    await prisma.blockedEmail.create({ data: { eventId: f.ev.id, email: "alice@x.co" } });
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.code).toBe("EMAIL_BLOCKED");
  });

  it("returns 409 DOCUMENT_BLOCKED", async () => {
    const f = await setup();
    await prisma.blockedDocument.create({ data: { eventId: f.ev.id, documentNumber: "ABC123" } });
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DOCUMENT_BLOCKED");
  });

  it("returns 429 QUOTA_EXCEEDED when org quota reached", async () => {
    const f = await setup({ quota: 1 });
    await prisma.registration.create({
      data: {
        id: "100000000001",
        eventId: f.ev.id, categoryId: f.cat.id,
        email: "x@x", firstName: "X", lastName: "X", structure: "S",
        idDocumentType: "CNI", idDocumentNumber: "ZZZ",
      },
    });
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
  });

  it("does not count REJECTED registrations against the quota", async () => {
    const f = await setup({ quota: 1 });
    await prisma.registration.create({
      data: {
        id: "100000000099",
        eventId: f.ev.id, categoryId: f.cat.id,
        email: "rej@x", firstName: "Rej", lastName: "Ected", structure: "S",
        idDocumentType: "CNI", idDocumentNumber: "REJ1",
        status: "REJECTED",
      },
    });
    const res = await POST(req(f.ev.slug, body({}, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(201);
  });

  it("returns 400 on invalid photoToken (wrong event)", async () => {
    const f = await setup();
    const bad = signUploadToken({ eventId: "other", kind: "photo", storageKey: "k" });
    const res = await POST(req(f.ev.slug, body({ photoToken: bad }, f)) as unknown as Request, { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toMatch(/UPLOAD_TOKEN/);
  });

  it("returns 429 when rate-limited (11th request)", async () => {
    const f = await setup();
    for (let i = 0; i < 10; i++) {
      await POST(req(f.ev.slug, body({ email: `u${i}@x.co`, idDocumentNumber: `N${i}` }, f)) as unknown as Request,
        { params: Promise.resolve({ slug: f.ev.slug }) });
    }
    const res = await POST(req(f.ev.slug, body({ email: "extra@x.co", idDocumentNumber: "EXTRA" }, f)) as unknown as Request,
      { params: Promise.resolve({ slug: f.ev.slug }) });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });
});
```

- [ ] **Step 9.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-registrations.test.ts
```

Expected: FAIL.

- [ ] **Step 9.3: Implement `src/app/api/public/events/[slug]/registrations/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { resolveSettings } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { publicRegistrationSchema } from "@/lib/validators/registration";
import { verifyUploadToken, UploadTokenError } from "@/lib/upload-token";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { generateId } from "@/lib/generate-id";
import { logActivity } from "@/lib/activity-log";

// best-effort: import the email helper if Plan 6 has been applied
let sendRegistrationConfirmation: (id: string) => Promise<void>;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ sendRegistrationConfirmation } = require("@/lib/mail"));
} catch {
  sendRegistrationConfirmation = async () => {};
}

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, `public-registration:${slug}`);
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes", code: "RATE_LIMITED" }, { status: 429 });
  }

  let bundle: Awaited<ReturnType<typeof loadPublicEventBySlug>>;
  try {
    bundle = await loadPublicEventBySlug(slug);
  } catch (err) {
    if (err instanceof PublicEventError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.code, code: err.code }, { status });
    }
    throw err;
  }
  const { event } = bundle;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide", code: "BAD_JSON" }, { status: 400 });
  }
  const parsed = publicRegistrationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", code: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Category belongs to this event?
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, eventId: event.id },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie invalide", code: "BAD_CATEGORY" }, { status: 400 });
  }

  // reCAPTCHA (uses ResolvedSettings with secret)
  const settings = await resolveSettings(event.id);
  const captcha = await verifyRecaptcha({
    enabled: settings.recaptchaEnabled,
    secretKey: settings.recaptchaSecretKey,
    token: data.recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json({ error: "reCAPTCHA refusé", code: `RECAPTCHA_${captcha.code}` }, { status: 400 });
  }

  // Blocklists
  const blockedEmail = await prisma.blockedEmail.findUnique({
    where: { eventId_email: { eventId: event.id, email: data.email } },
  });
  if (blockedEmail) {
    return NextResponse.json({ error: "Email bloqué", code: "EMAIL_BLOCKED" }, { status: 409 });
  }
  const blockedDoc = await prisma.blockedDocument.findUnique({
    where: { eventId_documentNumber: { eventId: event.id, documentNumber: data.idDocumentNumber } },
  });
  if (blockedDoc) {
    return NextResponse.json({ error: "Document bloqué", code: "DOCUMENT_BLOCKED" }, { status: 409 });
  }

  // Org quota
  if (event.organization && bundle.event.orgId) {
    const org = await prisma.organization.findUnique({ where: { id: bundle.event.orgId } });
    if (org?.quotaMaxRegistrations !== null && org?.quotaMaxRegistrations !== undefined) {
      // Les inscriptions rejetees ne comptent pas dans le quota
      const count = await prisma.registration.count({
        where: { event: { orgId: org.id }, status: { in: ["PENDING", "APPROVED"] } },
      });
      if (count >= org.quotaMaxRegistrations) {
        return NextResponse.json({ error: "Inscriptions complètes", code: "QUOTA_EXCEEDED" }, { status: 429 });
      }
    }
  }

  // Verify upload tokens
  let photoPayload, docPayload;
  try { photoPayload = verifyUploadToken(data.photoToken); }
  catch (e) {
    const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
    return NextResponse.json({ error: "Photo invalide", code }, { status: 400 });
  }
  try { docPayload = verifyUploadToken(data.idDocumentToken); }
  catch (e) {
    const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
    return NextResponse.json({ error: "Document invalide", code }, { status: 400 });
  }
  if (photoPayload.eventId !== event.id || photoPayload.kind !== "photo") {
    return NextResponse.json({ error: "Photo invalide", code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
  }
  if (docPayload.eventId !== event.id || docPayload.kind !== "document") {
    return NextResponse.json({ error: "Document invalide", code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
  }

  // Sequential count for badge ID generation
  const sequential = await prisma.registration.count({
    where: { eventId: event.id, categoryId: category.id },
  });
  const dateIso = event.date.toISOString().slice(0, 10);

  // Generate ID and avoid (very unlikely) collisions
  let id = generateId({ categoryNumber: category.number, date: dateIso, sequentialNumber: sequential + 1 });
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.registration.findUnique({ where: { id } });
    if (!exists) break;
    id = generateId({ categoryNumber: category.number, date: dateIso, sequentialNumber: sequential + 1 + attempt + 1 });
  }

  const registration = await prisma.registration.create({
    data: {
      id,
      eventId: event.id,
      categoryId: category.id,
      email: data.email,
      lastName: data.lastName,
      firstName: data.firstName,
      structure: data.structure,
      idDocumentType: data.idDocumentType,
      idDocumentNumber: data.idDocumentNumber,
      photo: photoPayload.storageKey,
      idDocument: docPayload.storageKey,
      status: "PENDING",
    },
  });

  await logActivity({
    type: "REGISTRATION_CREATED",
    eventId: event.id,
    targetId: registration.id,
    req: req as unknown as never,
  });

  // Fire and forget
  sendRegistrationConfirmation(registration.id).catch((err) => {
    console.error("[mail] sendRegistrationConfirmation failed", err);
  });

  return NextResponse.json({ id: registration.id }, { status: 201 });
}
```

- [ ] **Step 9.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-registrations.test.ts
```

Expected: 9 passed.

- [ ] **Step 9.5: Commit**

```bash
git add src/app/api/public/events/[slug]/registrations/route.ts src/app/api/__tests__/public-registrations.test.ts
git commit -m "feat(v2): POST inscription publique (recaptcha, quotas, blocklists, tokens)"
```

---

## Task 10: Verify badge — `GET /api/public/verify/[badgeId]` + page

**Files:**
- Create: `src/app/api/public/verify/[badgeId]/route.ts`
- Create: `src/app/api/__tests__/public-verify.test.ts`
- Create: `src/app/verify/[badgeId]/page.tsx`
- Create: `src/components/public/BadgeVerifyView.tsx`

The API and the page both check the same conditions:
- Registration exists
- `status === APPROVED && badgePrinted === true` ⇒ "Badge valide"
- Anything else ⇒ "Badge non valide" (no extra detail leaks)
- If `Category.anonymous === true`, mask `firstName`/`lastName` (show only category + event).

- [ ] **Step 10.1: Write failing tests for API**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/public/verify/[badgeId]/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
});

async function makeRegistration({ status = "APPROVED", printed = true, anonymous = false } = {}) {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const ev = await prisma.event.create({
    data: { orgId: org.id, title: "Cerimonia", slug: `s-${Date.now()}`, location: "L", date: new Date("2026-06-01"), registrationOpen: true },
  });
  const cat = await prisma.category.create({
    data: { eventId: ev.id, name: "Presse", color: "#fff", number: 1, anonymous },
  });
  return prisma.registration.create({
    data: {
      id: "111111111111",
      eventId: ev.id, categoryId: cat.id,
      email: "x@x", firstName: "Alice", lastName: "Doe", structure: "S",
      idDocumentType: "CNI", idDocumentNumber: "X1",
      status: status as never,
      badgePrinted: printed, badgePrintedAt: printed ? new Date() : null,
    },
  });
}

describe("GET /api/public/verify/[badgeId]", () => {
  it("returns valid=true with details for an approved printed badge", async () => {
    await makeRegistration({ status: "APPROVED", printed: true });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(true);
    expect(j.participant.firstName).toBe("Alice");
    expect(j.category.name).toBe("Presse");
  });

  it("masks identity when anonymous category", async () => {
    await makeRegistration({ status: "APPROVED", printed: true, anonymous: true });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(true);
    expect(j.participant).toBeUndefined();
    expect(j.category.anonymous).toBe(true);
  });

  it("returns valid=false for PENDING", async () => {
    await makeRegistration({ status: "PENDING", printed: false });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(false);
    expect(j.participant).toBeUndefined();
  });

  it("returns valid=false when approved but not printed", async () => {
    await makeRegistration({ status: "APPROVED", printed: false });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    expect((await res.json()).valid).toBe(false);
  });

  it("returns 404 for unknown badge", async () => {
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "000000000000" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 10.2: Run to verify failure**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-verify.test.ts
```

Expected: FAIL.

- [ ] **Step 10.3: Implement `src/app/api/public/verify/[badgeId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ badgeId: string }> }) {
  const { badgeId } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-verify");
  if (!rl.ok) return NextResponse.json({ error: "Rate limited", code: "RATE_LIMITED" }, { status: 429 });

  const registration = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: { select: { id: true, name: true, color: true, anonymous: true } },
      event: { select: { id: true, title: true, date: true, slug: true, archived: true } },
    },
  });
  if (!registration) return NextResponse.json({ valid: false, code: "NOT_FOUND" }, { status: 404 });

  const valid = registration.status === "APPROVED" && registration.badgePrinted;

  await logActivity({
    type: "BADGE_SCANNED",
    eventId: registration.eventId,
    targetId: registration.id,
    details: { valid, source: "public-verify" },
    req: req as unknown as never,
  });

  if (!valid) {
    return NextResponse.json({
      valid: false,
      event: { title: registration.event.title, date: registration.event.date },
    });
  }

  const cat = registration.category;
  const base = {
    valid: true as const,
    event: { title: registration.event.title, date: registration.event.date },
    category: { id: cat.id, name: cat.name, color: cat.color, anonymous: cat.anonymous },
  };
  if (cat.anonymous) return NextResponse.json(base);
  return NextResponse.json({
    ...base,
    participant: {
      firstName: registration.firstName,
      lastName: registration.lastName,
      structure: registration.structure,
    },
  });
}
```

- [ ] **Step 10.4: Run API tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-verify.test.ts
```

Expected: 5 passed.

- [ ] **Step 10.5: Implement `src/components/public/BadgeVerifyView.tsx`**

```tsx
import { formatDate } from "@/lib/format-date";

type Props = {
  data:
    | { valid: false; event?: { title: string; date: Date | string } }
    | {
        valid: true;
        event: { title: string; date: Date | string };
        category: { name: string; color: string; anonymous: boolean };
        participant?: { firstName: string; lastName: string; structure: string };
      };
};

export function BadgeVerifyView({ data }: Props) {
  if (!data.valid) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
        <h1 className="text-2xl font-semibold text-red-700">Badge non valide</h1>
        <p className="mt-2 text-sm text-red-700">
          Ce badge n&apos;est pas reconnu comme valide. Présentez-vous à l&apos;accueil.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6">
      <h1 className="text-2xl font-semibold text-emerald-800">Accès autorisé</h1>
      <p className="mt-1 text-sm text-emerald-800">
        {data.event.title} — {formatDate(data.event.date as Date)}
      </p>
      <div
        className="mt-4 inline-flex rounded-full px-3 py-1 text-sm font-medium text-white"
        style={{ backgroundColor: data.category.color }}
      >
        {data.category.name}
      </div>
      {data.participant && (
        <div className="mt-4 text-emerald-900">
          <div className="text-lg font-medium">
            {data.participant.firstName} {data.participant.lastName}
          </div>
          <div className="text-sm">{data.participant.structure}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10.6: Implement `src/app/verify/[badgeId]/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { BadgeVerifyView } from "@/components/public/BadgeVerifyView";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VerifyPage(
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const { badgeId } = await params;
  const reg = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: { select: { name: true, color: true, anonymous: true } },
      event: { select: { title: true, date: true } },
    },
  });

  if (!reg) notFound();

  const valid = reg.status === "APPROVED" && reg.badgePrinted;
  const data = valid
    ? {
        valid: true as const,
        event: reg.event,
        category: reg.category,
        participant: reg.category.anonymous
          ? undefined
          : { firstName: reg.firstName, lastName: reg.lastName, structure: reg.structure },
      }
    : { valid: false as const, event: reg.event };

  return (
    <main className="mx-auto max-w-md p-6">
      <BadgeVerifyView data={data} />
    </main>
  );
}
```

- [ ] **Step 10.7: Commit**

```bash
git add src/app/api/public/verify src/app/api/__tests__/public-verify.test.ts \
        src/app/verify src/components/public/BadgeVerifyView.tsx
git commit -m "feat(v2): verification publique badge (API + page, masque anonyme)"
```

---

## Task 11: Edit registration — GET + POST `/api/public/edit-registration/[token]`

**Files:**
- Create: `src/app/api/public/edit-registration/[token]/route.ts` (GET + POST)
- Create: `src/app/api/__tests__/public-edit.test.ts`

**GET :**
- Find registration where `editToken === token` and `editTokenExpiresAt > now`.
- Return registration + categories + public settings (similar to `loadPublicEventBySlug` shape but scoped to the registration's event).
- 404 if not found; 410 GONE if expired (front uses this to show the "Lien expiré" UI).

**POST :**
- Validate `editRegistrationSchema`.
- Verify any new upload tokens (optional — keep existing files if tokens not provided).
- Transaction:
  1. Insert `SubmissionSnapshot` from current state.
  2. Update the registration with new fields (status = PENDING, editToken = null, editTokenExpiresAt = null, rejectionReason/Details = null).
- `logActivity({ type: REGISTRATION_RESUBMITTED, eventId, targetId, req })`.
- Best-effort `sendRegistrationConfirmation` (resubmission).
- Return `{ id }`.

- [ ] **Step 11.1: Write failing tests**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/public/edit-registration/[token]/route";
import { signUploadToken } from "@/lib/upload-token";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { eventPhotoKey, eventIdDocumentKey, uploadFile } from "@/lib/storage";

beforeAll(() => { process.env.UPLOAD_TOKEN_SECRET = "test-secret"; });

async function setup({ expired = false } = {}) {
  await prisma.activityLog.deleteMany();
  await prisma.submissionSnapshot.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton", smtpHost: "", smtpPort: 587, smtpFrom: "n@x",
      smtpUser: "", smtpPassword: "", smtpSecure: false,
      recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
    },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const ev = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "", date: new Date("2026-06-01"), registrationOpen: true },
  });
  const cat = await prisma.category.create({ data: { eventId: ev.id, name: "C", color: "#fff", number: 7 } });
  const editToken = "tok-" + Math.random().toString(36).slice(2);
  const reg = await prisma.registration.create({
    data: {
      id: "222222222222",
      eventId: ev.id, categoryId: cat.id,
      email: "old@x", firstName: "Old", lastName: "Name", structure: "Old",
      idDocumentType: "CNI", idDocumentNumber: "OLD1",
      status: "REJECTED",
      rejectionReason: "DocumentInvalide",
      rejectionDetails: "Pieces illisibles",
      editToken,
      editTokenExpiresAt: expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 48 * 3600 * 1000),
    },
  });
  return { org, ev, cat, reg, editToken };
}

beforeEach(resetRateLimitForTests);

describe("GET /api/public/edit-registration/[token]", () => {
  it("returns the registration + categories", async () => {
    const f = await setup();
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ token: f.editToken }) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.registration.email).toBe("old@x");
    expect(j.registration.rejectionReason).toBe("DocumentInvalide");
    expect(j.categories).toHaveLength(1);
    expect("smtpPassword" in j.settings).toBe(false);
  });

  it("returns 410 GONE for expired token", async () => {
    const f = await setup({ expired: true });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ token: f.editToken }) });
    expect(res.status).toBe(410);
  });

  it("returns 404 for unknown token", async () => {
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ token: "missing" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/public/edit-registration/[token]", () => {
  it("resubmits: snapshot, update, status PENDING, editToken cleared, activity log", async () => {
    const f = await setup();
    // new uploads on disk
    const photoKey = eventPhotoKey(f.ev.id, "newp.jpg");
    const docKey = eventIdDocumentKey(f.ev.id, "newd.pdf");
    await uploadFile(photoKey, Buffer.from("p"), "image/jpeg");
    await uploadFile(docKey, Buffer.from("d"), "application/pdf");
    const photoToken = signUploadToken({ eventId: f.ev.id, kind: "photo", storageKey: photoKey });
    const documentToken = signUploadToken({ eventId: f.ev.id, kind: "document", storageKey: docKey });

    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
        body: JSON.stringify({
          email: "new@x.co",
          firstName: "New",
          lastName: "Name",
          structure: "Acme",
          categoryId: f.cat.id,
          idDocumentType: "CNI",
          idDocumentNumber: "NEW1",
          photoToken,
          idDocumentToken: documentToken,
          recaptchaToken: "",
        }),
      }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    expect(res.status).toBe(200);

    const updated = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.email).toBe("new@x.co");
    expect(updated?.editToken).toBeNull();
    expect(updated?.rejectionReason).toBeNull();

    const snap = await prisma.submissionSnapshot.findFirst({ where: { registrationId: f.reg.id } });
    expect(snap?.email).toBe("old@x");

    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_RESUBMITTED" } });
    expect(log?.targetId).toBe(f.reg.id);
  });

  it("returns 410 for expired token", async () => {
    const f = await setup({ expired: true });
    const res = await POST(
      new Request("http://t", { method: "POST", body: JSON.stringify({}) }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    expect(res.status).toBe(410);
  });

  it("keeps existing photo/document if no new token provided", async () => {
    const f = await setup();
    // existing photo on the registration
    await prisma.registration.update({ where: { id: f.reg.id }, data: { photo: "events/x/photos/old.jpg", idDocument: "events/x/idDocuments/old.pdf" } });
    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
        body: JSON.stringify({
          email: "still@x.co",
          firstName: "Still",
          lastName: "Same",
          structure: "Acme",
          categoryId: f.cat.id,
          idDocumentType: "CNI",
          idDocumentNumber: "Z1",
          photoToken: "",
          idDocumentToken: "",
        }),
      }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    expect(res.status).toBe(200);
    const u = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    expect(u?.photo).toBe("events/x/photos/old.jpg");
  });
});
```

- [ ] **Step 11.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-edit.test.ts
```

Expected: FAIL.

- [ ] **Step 11.3: Implement `src/app/api/public/edit-registration/[token]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings, resolveSettings } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { editRegistrationSchema } from "@/lib/validators/registration";
import { verifyUploadToken, UploadTokenError } from "@/lib/upload-token";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

let sendRegistrationConfirmation: (id: string) => Promise<void>;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ sendRegistrationConfirmation } = require("@/lib/mail"));
} catch {
  sendRegistrationConfirmation = async () => {};
}

export const runtime = "nodejs";

async function loadByToken(token: string) {
  const reg = await prisma.registration.findUnique({
    where: { editToken: token },
    include: {
      event: { select: { id: true, slug: true, title: true, date: true, archived: true, registrationOpen: true, orgId: true, logo: true, location: true } },
      category: { select: { id: true, name: true, color: true, number: true, anonymous: true } },
    },
  });
  if (!reg) return { code: "NOT_FOUND" as const };
  if (!reg.editTokenExpiresAt || reg.editTokenExpiresAt < new Date()) {
    return { code: "GONE" as const };
  }
  return { code: "OK" as const, reg };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-edit-get");
  if (!rl.ok) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });

  const r = await loadByToken(token);
  if (r.code === "NOT_FOUND") return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (r.code === "GONE") return NextResponse.json({ code: "GONE" }, { status: 410 });

  const categories = await prisma.category.findMany({
    where: { eventId: r.reg.eventId },
    orderBy: { number: "asc" },
  });
  const settings = await resolvePublicSettings(r.reg.eventId);

  return NextResponse.json({
    event: r.reg.event,
    categories,
    settings,
    registration: {
      id: r.reg.id,
      email: r.reg.email,
      firstName: r.reg.firstName,
      lastName: r.reg.lastName,
      structure: r.reg.structure,
      categoryId: r.reg.categoryId,
      idDocumentType: r.reg.idDocumentType,
      idDocumentNumber: r.reg.idDocumentNumber,
      photo: r.reg.photo,
      idDocument: r.reg.idDocument,
      rejectionReason: r.reg.rejectionReason,
      rejectionDetails: r.reg.rejectionDetails,
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-edit-post");
  if (!rl.ok) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });

  const r = await loadByToken(token);
  if (r.code === "NOT_FOUND") return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (r.code === "GONE") return NextResponse.json({ code: "GONE" }, { status: 410 });
  const reg = r.reg;

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ code: "BAD_JSON" }, { status: 400 });
  }
  const parsed = editRegistrationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  // Category must belong to this event
  const cat = await prisma.category.findFirst({ where: { id: data.categoryId, eventId: reg.eventId } });
  if (!cat) return NextResponse.json({ code: "BAD_CATEGORY" }, { status: 400 });

  // reCAPTCHA (event-scoped)
  const settings = await resolveSettings(reg.eventId);
  const captcha = await verifyRecaptcha({
    enabled: settings.recaptchaEnabled,
    secretKey: settings.recaptchaSecretKey,
    token: data.recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json({ code: `RECAPTCHA_${captcha.code}` }, { status: 400 });
  }

  // Optional new uploads
  let newPhoto: string | null = null;
  let newDoc: string | null = null;
  if (data.photoToken) {
    try {
      const p = verifyUploadToken(data.photoToken);
      if (p.eventId !== reg.eventId || p.kind !== "photo") {
        return NextResponse.json({ code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
      }
      newPhoto = p.storageKey;
    } catch (e) {
      const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
      return NextResponse.json({ code }, { status: 400 });
    }
  }
  if (data.idDocumentToken) {
    try {
      const p = verifyUploadToken(data.idDocumentToken);
      if (p.eventId !== reg.eventId || p.kind !== "document") {
        return NextResponse.json({ code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
      }
      newDoc = p.storageKey;
    } catch (e) {
      const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
      return NextResponse.json({ code }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.submissionSnapshot.create({
      data: {
        registrationId: reg.id,
        email: reg.email, firstName: reg.firstName, lastName: reg.lastName,
        structure: reg.structure, categoryId: reg.categoryId,
        idDocumentType: reg.idDocumentType, idDocumentNumber: reg.idDocumentNumber,
        photo: reg.photo, idDocument: reg.idDocument,
      },
    });
    await tx.registration.update({
      where: { id: reg.id },
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        structure: data.structure,
        categoryId: cat.id,
        idDocumentType: data.idDocumentType,
        idDocumentNumber: data.idDocumentNumber,
        photo: newPhoto ?? reg.photo,
        idDocument: newDoc ?? reg.idDocument,
        status: "PENDING",
        rejectionReason: null,
        rejectionDetails: null,
        editToken: null,
        editTokenExpiresAt: null,
      },
    });
  });

  await logActivity({
    type: "REGISTRATION_RESUBMITTED",
    eventId: reg.eventId,
    targetId: reg.id,
    req: req as unknown as never,
  });

  sendRegistrationConfirmation(reg.id).catch((err) =>
    console.error("[mail] resubmit confirmation failed", err),
  );

  return NextResponse.json({ id: reg.id });
}
```

- [ ] **Step 11.4: Run tests to verify pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-edit.test.ts
```

Expected: 6 passed.

- [ ] **Step 11.5: Commit**

```bash
git add src/app/api/public/edit-registration src/app/api/__tests__/public-edit.test.ts
git commit -m "feat(v2): edit-registration GET+POST (snapshot, status PENDING, token usage)"
```

---

## Task 12: Resend edit link — `POST /api/public/edit-registration/[token]/resend`

**Files:**
- Create: `src/app/api/public/edit-registration/[token]/resend/route.ts`
- Append tests to `src/app/api/__tests__/public-edit.test.ts` (or new file)

**Flow:**
- Accepts the **expired** token (or the registration's email — to be discussed; we choose token here for simplicity, since the front holds the expired token from the URL).
- Looks up the registration by `editToken`. If found, regenerate `editToken` + `editTokenExpiresAt` (48h).
- Cooldown: 60s between resend calls per registration (additional in-memory map keyed by `registrationId`).
- `logActivity({ type: EDIT_LINK_SENT, ... })`.
- Calls `sendEditLinkEmail(registrationId)`.
- Returns `{ ok: true }` regardless of whether the email was found (anti-enumeration), but still respects cooldown.

- [ ] **Step 12.1: Write failing tests** (append at the bottom of `public-edit.test.ts`):

```typescript
import { POST as RESEND } from "@/app/api/public/edit-registration/[token]/resend/route";

describe("POST /api/public/edit-registration/[token]/resend", () => {
  it("regenerates the editToken and logs EDIT_LINK_SENT", async () => {
    // setup expired then ask to resend
    const f = await setup({ expired: true });
    const before = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    const res = await RESEND(
      new Request("http://t", { method: "POST", headers: { "x-forwarded-for": "9.9.9.10" } }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    expect(after?.editToken).not.toBe(before?.editToken);
    expect(after?.editTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const log = await prisma.activityLog.findFirst({ where: { type: "EDIT_LINK_SENT" } });
    expect(log?.targetId).toBe(f.reg.id);
  });

  it("enforces 60s cooldown per registration", async () => {
    const f = await setup({ expired: true });
    await RESEND(
      new Request("http://t", { method: "POST", headers: { "x-forwarded-for": "9.9.9.11" } }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    // immediate second attempt — but token has changed, we must look up again
    const after1 = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    const res = await RESEND(
      new Request("http://t", { method: "POST", headers: { "x-forwarded-for": "9.9.9.11" } }) as unknown as Request,
      { params: Promise.resolve({ token: after1!.editToken! }) },
    );
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("COOLDOWN");
  });

  it("returns 200 even for unknown token (anti-enumeration)", async () => {
    const res = await RESEND(
      new Request("http://t", { method: "POST" }) as unknown as Request,
      { params: Promise.resolve({ token: "ghost" }) },
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 12.2: Implement `src/app/api/public/edit-registration/[token]/resend/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

let sendEditLinkEmail: (id: string) => Promise<void>;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ sendEditLinkEmail } = require("@/lib/mail"));
} catch {
  sendEditLinkEmail = async () => {};
}

const COOLDOWN_MS = 60_000;
const cooldownByReg = new Map<string, number>();
const EDIT_TOKEN_TTL_MS = 48 * 3600 * 1000;

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));

  // IP-level rate limit (in case attacker tries many tokens)
  const rl = checkRateLimit(ip, "public-edit-resend");
  if (!rl.ok) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });

  const reg = await prisma.registration.findUnique({ where: { editToken: token } });
  if (!reg) return NextResponse.json({ ok: true }); // anti-enumeration

  const lastAt = cooldownByReg.get(reg.id) ?? 0;
  if (Date.now() - lastAt < COOLDOWN_MS) {
    return NextResponse.json({ code: "COOLDOWN" }, { status: 429 });
  }
  cooldownByReg.set(reg.id, Date.now());

  const newToken = randomBytes(32).toString("hex");
  await prisma.registration.update({
    where: { id: reg.id },
    data: {
      editToken: newToken,
      editTokenExpiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_MS),
    },
  });
  await logActivity({
    type: "EDIT_LINK_SENT",
    eventId: reg.eventId,
    targetId: reg.id,
    req: req as unknown as never,
  });
  sendEditLinkEmail(reg.id).catch((err) => console.error("[mail] resend edit-link failed", err));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 12.3: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-edit.test.ts
```

Expected: all (previous + new) pass.

- [ ] **Step 12.4: Commit**

```bash
git add src/app/api/public/edit-registration/[token]/resend src/app/api/__tests__/public-edit.test.ts
git commit -m "feat(v2): resend edit-link (cooldown 60s, anti-enumeration)"
```

---

## Task 13: PublicEventLayout + small UI helpers

**Files:**
- Create: `src/components/public/PublicEventLayout.tsx`
- Create: `src/app/e/[slug]/closed.tsx` (small helper component used by `page.tsx`)

The layout is shared by `/e/[slug]`, `/e/[slug]/success`, `/edit-registration/[token]` and (optionally) `/verify/[badgeId]` to render the org branding consistently.

- [ ] **Step 13.1: Implement `src/components/public/PublicEventLayout.tsx`**

```tsx
import Image from "next/image";
import { formatDate } from "@/lib/format-date";

type Props = {
  event: { title: string; date: Date | string; location: string; logo?: string | null };
  contact?: { email?: string; phone?: string };
  children: React.ReactNode;
};

export function PublicEventLayout({ event, contact, children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          {event.logo && (
            <Image
              src={`/api/files/${event.logo}`}
              alt={event.title}
              width={56}
              height={56}
              className="h-14 w-14 rounded object-contain"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{event.title}</h1>
            <p className="text-sm text-neutral-600">
              {formatDate(event.date as Date)}
              {event.location ? ` — ${event.location}` : ""}
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center text-xs text-neutral-500">
          {(contact?.email || contact?.phone) && (
            <p>
              Contact :{" "}
              {contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact?.email && contact?.phone && " — "}
              {contact?.phone}
            </p>
          )}
          <p className="mt-1">Propulsé par Badge</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 13.2: Implement `src/app/e/[slug]/closed.tsx`**

```tsx
type Props = { reason: "NOT_FOUND" | "CLOSED" };

export function ClosedView({ reason }: Props) {
  return (
    <div className="rounded-lg border bg-white p-6 text-center">
      <h2 className="text-xl font-semibold text-neutral-900">
        {reason === "NOT_FOUND" ? "Événement introuvable" : "Inscriptions fermées"}
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        {reason === "NOT_FOUND"
          ? "Le lien suivi ne correspond à aucun événement."
          : "Les inscriptions à cet événement ne sont pas (ou plus) ouvertes."}
      </p>
    </div>
  );
}
```

- [ ] **Step 13.3: Commit**

```bash
git add src/components/public/PublicEventLayout.tsx src/app/e/[slug]/closed.tsx
git commit -m "feat(v2): layout public (logo, titre, contact resolu, footer)"
```

---

## Task 14: PublicRegistrationForm (client) + FileUploadField

**Files:**
- Create: `src/components/public/FileUploadField.tsx`
- Create: `src/components/public/PublicRegistrationForm.tsx`

The form is a Client Component using the Zod schema (parse on submit), `react-google-recaptcha-v3` for the captcha token, and a two-phase upload via `POST /api/upload?context=event:<slug>&kind=<photo|document>`. The upload result `{ token, originalName, size }` is stored in component state and submitted along with the rest.

- [ ] **Step 14.1: Implement `src/components/public/FileUploadField.tsx`**

```tsx
"use client";

import { useState } from "react";

export type UploadedFile = { token: string; name: string; size: number };

type Props = {
  label: string;
  kind: "photo" | "document";
  slug: string;
  accept: string;
  initialName?: string;
  onUploaded: (file: UploadedFile | null) => void;
};

export function FileUploadField({ label, kind, slug, accept, initialName, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux (5 Mo max)");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload?context=event:${slug}&kind=${kind}`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.code || `HTTP ${res.status}`);
      }
      const j = await res.json();
      const u: UploadedFile = { token: j.token, name: j.originalName, size: j.size };
      setUploaded(u);
      onUploaded(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      <input type="file" accept={accept} onChange={handleChange} disabled={uploading}
             className="block w-full text-sm" />
      {uploading && <p className="text-xs text-neutral-500">Envoi en cours…</p>}
      {uploaded && <p className="text-xs text-emerald-700">Fichier envoyé : {uploaded.name}</p>}
      {!uploaded && initialName && <p className="text-xs text-neutral-500">Fichier actuel : {initialName}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 14.2: Implement `src/components/public/PublicRegistrationForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicRegistrationSchema, ID_DOC_TYPES } from "@/lib/validators/registration";
import { FileUploadField, type UploadedFile } from "./FileUploadField";

type Category = { id: string; name: string; color: string; number: number; anonymous: boolean };
type Settings = { recaptchaEnabled: boolean; recaptchaSiteKey: string };

type Props = {
  slug: string;
  categories: Category[];
  settings: Settings;
};

export function PublicRegistrationForm({ slug, categories, settings }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [structure, setStructure] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [idDocumentType, setIdDocumentType] = useState<typeof ID_DOC_TYPES[number]>("CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [document_, setDocument_] = useState<UploadedFile | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    let recaptchaToken = "";
    if (settings.recaptchaEnabled && settings.recaptchaSiteKey) {
      // grecaptcha is loaded via the layout (script tag)
      const grecaptcha = (window as unknown as { grecaptcha?: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha;
      if (grecaptcha) {
        recaptchaToken = await grecaptcha.execute(settings.recaptchaSiteKey, { action: "register" });
      }
    }

    const payload = {
      email, firstName, lastName, structure, categoryId,
      idDocumentType, idDocumentNumber,
      photoToken: photo?.token ?? "",
      idDocumentToken: document_?.token ?? "",
      recaptchaToken,
    };
    const parsed = publicRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError("Merci de vérifier les champs : " + parsed.error.issues.map(i => i.message).join(", "));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/events/${slug}/registrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setServerError(translateServerCode(j.code, res.status));
        return;
      }
      router.push(`/e/${slug}/success`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      {serverError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      )}

      <Field label="Email" value={email} onChange={setEmail} type="email" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" value={firstName} onChange={setFirstName} required />
        <Field label="Nom" value={lastName} onChange={setLastName} required />
      </div>
      <Field label="Structure" value={structure} onChange={setStructure} required />

      <fieldset>
        <legend className="block text-sm font-medium text-neutral-800">Catégorie</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded border p-2 ${categoryId === c.id ? "ring-2 ring-blue-500" : ""}`}>
              <input type="radio" name="category" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} />
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Type de pièce</label>
          <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value as typeof ID_DOC_TYPES[number])} className="mt-1 block w-full rounded border-neutral-300">
            {ID_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Field label="Numéro de pièce" value={idDocumentNumber} onChange={setIdDocumentNumber} required />
      </div>

      <FileUploadField label="Photo (JPEG/PNG/WebP, 5 Mo max)" kind="photo" slug={slug}
        accept="image/jpeg,image/png,image/webp" onUploaded={setPhoto} />
      <FileUploadField label="Pièce d'identité (JPEG/PNG/WebP/PDF, 5 Mo max)" kind="document" slug={slug}
        accept="image/jpeg,image/png,image/webp,application/pdf" onUploaded={setDocument_} />

      <button type="submit" disabled={submitting || !photo || !document_} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {submitting ? "Envoi…" : "Envoyer mon inscription"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required}
             className="mt-1 block w-full rounded border-neutral-300" />
    </div>
  );
}

function translateServerCode(code: string | undefined, status: number): string {
  switch (code) {
    case "QUOTA_EXCEEDED": return "Les inscriptions sont complètes.";
    case "EMAIL_BLOCKED": return "Cet email ne peut pas être utilisé pour cet événement.";
    case "DOCUMENT_BLOCKED": return "Ce numéro de pièce ne peut pas être utilisé pour cet événement.";
    case "RATE_LIMITED": return "Trop de tentatives. Réessayez dans une minute.";
    case "VALIDATION": return "Merci de vérifier les informations saisies.";
    default:
      if (code?.startsWith("RECAPTCHA_")) return "Vérification anti-spam échouée. Rechargez la page.";
      if (code?.startsWith("UPLOAD_TOKEN_")) return "Les fichiers envoyés ne sont plus valides. Rechargez et renvoyez.";
      return `Une erreur est survenue (${code ?? status}).`;
  }
}
```

- [ ] **Step 14.3: Commit**

```bash
git add src/components/public/FileUploadField.tsx src/components/public/PublicRegistrationForm.tsx
git commit -m "feat(v2): formulaire public inscription (upload 2-phases, captcha, validation)"
```

---

## Task 15: `/e/[slug]` Server Component page + success page

**Files:**
- Create: `src/app/e/[slug]/page.tsx`
- Create: `src/app/e/[slug]/success/page.tsx`

- [ ] **Step 15.1: Implement `src/app/e/[slug]/page.tsx`**

```tsx
import Script from "next/script";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { PublicRegistrationForm } from "@/components/public/PublicRegistrationForm";
import { ClosedView } from "./closed";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { event, categories, settings } = await loadPublicEventBySlug(slug);
    return (
      <PublicEventLayout
        event={event}
        contact={{ email: settings.contactEmail, phone: settings.contactPhone }}
      >
        {settings.recaptchaEnabled && settings.recaptchaSiteKey && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${settings.recaptchaSiteKey}`}
            strategy="afterInteractive"
          />
        )}
        <PublicRegistrationForm slug={slug} categories={categories} settings={settings} />
      </PublicEventLayout>
    );
  } catch (err) {
    if (err instanceof PublicEventError) {
      if (err.code === "NOT_FOUND") notFound();
      return (
        <main className="mx-auto max-w-md p-8">
          <ClosedView reason="CLOSED" />
        </main>
      );
    }
    throw err;
  }
}
```

- [ ] **Step 15.2: Implement `src/app/e/[slug]/success/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();
  const settings = await resolvePublicSettings(event.id);
  return (
    <PublicEventLayout event={event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
      <div className="rounded-lg border bg-white p-6 text-center">
        <h2 className="text-xl font-semibold text-neutral-900">Votre inscription a bien été enregistrée.</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Un email de confirmation vient de vous être envoyé. Conservez-le précieusement.
        </p>
        {settings.contactEmail && (
          <p className="mt-2 text-sm text-neutral-500">
            Pour toute question : <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          </p>
        )}
      </div>
    </PublicEventLayout>
  );
}
```

- [ ] **Step 15.3: Smoke test manually**

```bash
# Pre-condition: have a seeded org+event+category with registrationOpen=true and slug "demo"
# (use prisma studio or a one-liner)
curl -i http://localhost:3000/e/demo | head -5
```

Expected: 200, HTML containing the event title.

- [ ] **Step 15.4: Commit**

```bash
git add src/app/e/[slug]/page.tsx src/app/e/[slug]/success/page.tsx
git commit -m "feat(v2): page publique /e/[slug] + page de succes"
```

---

## Task 16: Edit registration page + EditRegistrationForm + expired page

**Files:**
- Create: `src/components/public/EditRegistrationForm.tsx`
- Create: `src/app/edit-registration/[token]/page.tsx`
- Create: `src/app/edit-registration/expired/page.tsx`

- [ ] **Step 16.1: Implement `src/components/public/EditRegistrationForm.tsx`**

It mirrors `PublicRegistrationForm` but with `initialValues` and a rejection notice. Uploads are optional (keep existing if not replaced).

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editRegistrationSchema, ID_DOC_TYPES } from "@/lib/validators/registration";
import { FileUploadField, type UploadedFile } from "./FileUploadField";

type Category = { id: string; name: string; color: string; number: number; anonymous: boolean };
type Settings = { recaptchaEnabled: boolean; recaptchaSiteKey: string };
type Initial = {
  email: string; firstName: string; lastName: string; structure: string;
  categoryId: string; idDocumentType: string; idDocumentNumber: string;
  photo: string | null; idDocument: string | null;
  rejectionReason: string | null; rejectionDetails: string | null;
};

type Props = {
  token: string;
  slug: string;
  categories: Category[];
  settings: Settings;
  initial: Initial;
};

export function EditRegistrationForm({ token, slug, categories, settings, initial }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [email, setEmail] = useState(initial.email);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [structure, setStructure] = useState(initial.structure);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [idDocumentType, setIdDocumentType] = useState(initial.idDocumentType);
  const [idDocumentNumber, setIdDocumentNumber] = useState(initial.idDocumentNumber);
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [document_, setDocument_] = useState<UploadedFile | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    let recaptchaToken = "";
    if (settings.recaptchaEnabled && settings.recaptchaSiteKey) {
      const grecaptcha = (window as unknown as { grecaptcha?: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha;
      if (grecaptcha) recaptchaToken = await grecaptcha.execute(settings.recaptchaSiteKey, { action: "resubmit" });
    }

    const payload = {
      email, firstName, lastName, structure, categoryId,
      idDocumentType, idDocumentNumber,
      photoToken: photo?.token ?? "",
      idDocumentToken: document_?.token ?? "",
      recaptchaToken,
    };
    const parsed = editRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError("Merci de vérifier les champs : " + parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/edit-registration/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setServerError(`Erreur (${j.code ?? res.status}). Réessayez.`);
        return;
      }
      router.push(`/e/${slug}/success`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      {initial.rejectionReason && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Inscription précédente refusée.</strong>
          <div>Motif : {initial.rejectionReason}</div>
          {initial.rejectionDetails && <div className="mt-1 whitespace-pre-line">{initial.rejectionDetails}</div>}
        </div>
      )}
      {serverError && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>}

      <Field label="Email" value={email} onChange={setEmail} type="email" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" value={firstName} onChange={setFirstName} required />
        <Field label="Nom" value={lastName} onChange={setLastName} required />
      </div>
      <Field label="Structure" value={structure} onChange={setStructure} required />

      <fieldset>
        <legend className="block text-sm font-medium text-neutral-800">Catégorie</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded border p-2 ${categoryId === c.id ? "ring-2 ring-blue-500" : ""}`}>
              <input type="radio" name="category" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} />
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Type de pièce</label>
          <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value)} className="mt-1 block w-full rounded border-neutral-300">
            {ID_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Field label="Numéro de pièce" value={idDocumentNumber} onChange={setIdDocumentNumber} required />
      </div>

      <FileUploadField label="Nouvelle photo (laisser vide pour garder l'actuelle)" kind="photo" slug={slug}
        accept="image/jpeg,image/png,image/webp" initialName={initial.photo ?? undefined} onUploaded={setPhoto} />
      <FileUploadField label="Nouveau document (laisser vide pour garder l'actuel)" kind="document" slug={slug}
        accept="image/jpeg,image/png,image/webp,application/pdf" initialName={initial.idDocument ?? undefined} onUploaded={setDocument_} />

      <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {submitting ? "Envoi…" : "Resoumettre"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required}
             className="mt-1 block w-full rounded border-neutral-300" />
    </div>
  );
}
```

- [ ] **Step 16.2: Implement `src/app/edit-registration/[token]/page.tsx`**

```tsx
import Script from "next/script";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { EditRegistrationForm } from "@/components/public/EditRegistrationForm";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reg = await prisma.registration.findUnique({
    where: { editToken: token },
    include: { event: true },
  });
  if (!reg) redirect("/edit-registration/expired?reason=NOT_FOUND");
  if (!reg.editTokenExpiresAt || reg.editTokenExpiresAt < new Date()) {
    redirect(`/edit-registration/expired?token=${encodeURIComponent(token)}`);
  }

  const categories = await prisma.category.findMany({
    where: { eventId: reg.eventId },
    orderBy: { number: "asc" },
  });
  const settings = await resolvePublicSettings(reg.eventId);

  return (
    <PublicEventLayout event={reg.event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
      {settings.recaptchaEnabled && settings.recaptchaSiteKey && (
        <Script src={`https://www.google.com/recaptcha/api.js?render=${settings.recaptchaSiteKey}`} strategy="afterInteractive" />
      )}
      <EditRegistrationForm
        token={token}
        slug={reg.event.slug}
        categories={categories}
        settings={settings}
        initial={{
          email: reg.email, firstName: reg.firstName, lastName: reg.lastName, structure: reg.structure,
          categoryId: reg.categoryId, idDocumentType: reg.idDocumentType, idDocumentNumber: reg.idDocumentNumber,
          photo: reg.photo, idDocument: reg.idDocument,
          rejectionReason: reg.rejectionReason, rejectionDetails: reg.rejectionDetails,
        }}
      />
    </PublicEventLayout>
  );
}
```

- [ ] **Step 16.3: Implement `src/app/edit-registration/expired/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ExpiredPage() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const reason = sp.get("reason") ?? "EXPIRED";
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/edit-registration/${token}/resend`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.code === "COOLDOWN") setError("Patientez 1 minute avant de réessayer.");
        else throw new Error(j.code || `HTTP ${res.status}`);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <div className="rounded-lg border bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          {reason === "NOT_FOUND" ? "Lien introuvable" : "Lien expiré"}
        </h1>
        <p className="mt-2 text-sm text-neutral-700">
          {reason === "NOT_FOUND"
            ? "Ce lien d'édition n'existe pas (ou plus)."
            : "Ce lien d'édition n'est plus valide. Vous pouvez en demander un nouveau."}
        </p>
        {token && reason !== "NOT_FOUND" && (
          <button onClick={resend} disabled={loading || sent}
                  className="mt-4 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {sent ? "Demande envoyée" : loading ? "Envoi…" : "Demander un nouveau lien"}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 16.4: Commit**

```bash
git add src/components/public/EditRegistrationForm.tsx \
        src/app/edit-registration/[token]/page.tsx \
        src/app/edit-registration/expired/page.tsx
git commit -m "feat(v2): page edit-registration + page expiree (resend)"
```

---

## Task 17: End-to-end integration test (DB-level)

**Files:**
- Create: `src/app/api/__tests__/public-e2e.test.ts`

This test exercises the entire public path through the route handlers (no browser): upload → register → reject → resend edit-link → edit → resubmit → approve → verify.

- [ ] **Step 17.1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as UPLOAD } from "@/app/api/upload/route";
import { POST as REGISTER } from "@/app/api/public/events/[slug]/registrations/route";
import { GET as VERIFY } from "@/app/api/public/verify/[badgeId]/route";
import { POST as EDIT } from "@/app/api/public/edit-registration/[token]/route";
import { POST as RESEND } from "@/app/api/public/edit-registration/[token]/resend/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

beforeAll(() => { process.env.UPLOAD_TOKEN_SECRET = "test-secret"; });

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.activityLog.deleteMany();
  await prisma.submissionSnapshot.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton", smtpHost: "", smtpPort: 587, smtpFrom: "n@x",
      smtpUser: "", smtpPassword: "", smtpSecure: false,
      recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
    },
  });
});

async function uploadFor(slug: string, kind: "photo" | "document") {
  const fd = new FormData();
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG-ish header
  const mime = kind === "photo" ? "image/png" : "application/pdf";
  fd.append("file", new Blob([bytes], { type: mime }), kind === "photo" ? "p.png" : "d.pdf");
  const res = await UPLOAD(new Request(`http://t/api/upload?context=event:${slug}&kind=${kind}`,
    { method: "POST", body: fd, headers: { "x-forwarded-for": "5.5.5.5" } }) as unknown as Request);
  expect(res.status).toBe(200);
  const j = await res.json();
  return j.token as string;
}

describe("public e2e", () => {
  it("goes through register -> reject -> edit -> resubmit -> approve -> verify", async () => {
    const org = await prisma.organization.create({ data: { name: "E2E", slug: "e2e-org" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E2E Event", slug: "e2e-evt", location: "L",
              date: new Date("2026-06-15"), registrationOpen: true },
    });
    const cat = await prisma.category.create({
      data: { eventId: ev.id, name: "VIP", color: "#000", number: 5 },
    });

    // 1. Upload + register
    const photoToken = await uploadFor(ev.slug, "photo");
    const docToken = await uploadFor(ev.slug, "document");
    const regRes = await REGISTER(new Request(`http://t/api/public/events/${ev.slug}/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5" },
      body: JSON.stringify({
        email: "alice@x.co", firstName: "Alice", lastName: "Doe", structure: "Acme",
        categoryId: cat.id, idDocumentType: "CNI", idDocumentNumber: "ABC",
        photoToken, idDocumentToken: docToken,
      }),
    }) as unknown as Request, { params: Promise.resolve({ slug: ev.slug }) });
    expect(regRes.status).toBe(201);
    const { id } = await regRes.json();

    // 2. Reject (simulated admin action — direct DB update with editToken)
    const editToken = randomBytes(32).toString("hex");
    await prisma.registration.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: "DocumentInvalide",
        rejectionDetails: "Photo floue",
        editToken,
        editTokenExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    // 3. Edit / resubmit
    const newPhotoToken = await uploadFor(ev.slug, "photo");
    const newDocToken = await uploadFor(ev.slug, "document");
    const editRes = await EDIT(new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5" },
      body: JSON.stringify({
        email: "alice@x.co", firstName: "Alice", lastName: "Doe", structure: "Acme",
        categoryId: cat.id, idDocumentType: "CNI", idDocumentNumber: "ABC",
        photoToken: newPhotoToken, idDocumentToken: newDocToken,
      }),
    }) as unknown as Request, { params: Promise.resolve({ token: editToken }) });
    expect(editRes.status).toBe(200);

    const afterEdit = await prisma.registration.findUnique({ where: { id } });
    expect(afterEdit?.status).toBe("PENDING");
    expect(afterEdit?.editToken).toBeNull();
    const snap = await prisma.submissionSnapshot.findFirst({ where: { registrationId: id } });
    expect(snap).toBeTruthy();

    // 4. Approve (simulated admin action) + print badge
    await prisma.registration.update({
      where: { id },
      data: { status: "APPROVED", badgePrinted: true, badgePrintedAt: new Date() },
    });

    // 5. Verify
    const verifyRes = await VERIFY(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: id }) });
    expect(verifyRes.status).toBe(200);
    const v = await verifyRes.json();
    expect(v.valid).toBe(true);
    expect(v.participant.firstName).toBe("Alice");
  });

  it("resend issues a fresh editToken on an expired one", async () => {
    const org = await prisma.organization.create({ data: { name: "E2E2", slug: "e2e2" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E2", slug: "e2e2-evt", location: "", date: new Date(), registrationOpen: true },
    });
    const cat = await prisma.category.create({ data: { eventId: ev.id, name: "C", color: "#fff", number: 1 } });
    const reg = await prisma.registration.create({
      data: {
        id: "999999999999",
        eventId: ev.id, categoryId: cat.id,
        email: "x@x", firstName: "X", lastName: "X", structure: "S",
        idDocumentType: "CNI", idDocumentNumber: "X1",
        status: "REJECTED",
        editToken: "old-tok",
        editTokenExpiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await RESEND(new Request("http://t", { method: "POST", headers: { "x-forwarded-for": "1.1.1.1" } }) as unknown as Request,
      { params: Promise.resolve({ token: "old-tok" }) });
    expect(res.status).toBe(200);
    const fresh = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(fresh?.editToken).not.toBe("old-tok");
    expect(fresh!.editTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 17.2: Run the test**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/__tests__/public-e2e.test.ts
```

Expected: 2 passed.

- [ ] **Step 17.3: Commit**

```bash
git add src/app/api/__tests__/public-e2e.test.ts
git commit -m "test(v2): integration e2e parcours public (register-reject-edit-approve-verify)"
```

---

## Task 18: Documentation update

**Files:**
- Modify: `docs/v2/features/inscription-publique.md` (mark plan as implemented)
- Modify: `docs/v2/api/` (create or extend with the public endpoints)

- [ ] **Step 18.1: Document API endpoints in `docs/v2/api/public.md`**

Create the file if it doesn't exist (otherwise extend). Document each route with method, path, query params, body schema, success response, error codes. Use the same style as the v1 docs.

- [ ] **Step 18.2: Add a section "État au lot D (post-Plan 5)" to `docs/v2/architecture.md`** noting that the public surface is in place and emails are stubbed pending Plan 6.

- [ ] **Step 18.3: Commit**

```bash
git add docs/v2/api/public.md docs/v2/architecture.md docs/v2/features/inscription-publique.md
git commit -m "docs(v2): API publique inscription + note avancement Plan 5"
```

---

## Task 19: Final verification

- [ ] **Step 19.1: Run the full test suite**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run
```

Expected: all tests pass (Plan 1 + Plan 5).

- [ ] **Step 19.2: Lint and typecheck**

```bash
make lint
make typecheck
```

Expected: clean. (Any v1 leftovers from Plan 1's Task 10 should have been cleaned up by Plans 2-4 already; if not, this Plan still works as long as its own files type-check — the legacy `src/app/admin/**` and `src/app/api/admin/**` are out of scope here.)

- [ ] **Step 19.3: Manual smoke test in a browser**

Pre-condition: seed an Organization + Event + Category with `registrationOpen=true`, slug `demo`.

```sql
-- one-liner via prisma studio or mysql client (executed by the operator)
```

Then in the browser:

1. Open `http://localhost:3000/e/demo` → form loads with category list.
2. Upload a photo (JPG) and a document (PDF) → both succeed.
3. Submit the form → redirect to `/e/demo/success`.
4. In Prisma Studio: set `status=REJECTED`, `rejectionReason="Test"`, `editToken=<uuid>`, `editTokenExpiresAt=NOW+48h`.
5. Open `http://localhost:3000/edit-registration/<uuid>` → form pre-filled with rejection notice.
6. Update fields, re-upload photo, submit → redirect to success.
7. In Prisma Studio: set `status=APPROVED`, `badgePrinted=true`.
8. Open `http://localhost:3000/verify/<registration.id>` → "Accès autorisé" with name and category.
9. Set `Category.anonymous=true` → reload → name is hidden.
10. Set `Category.anonymous=false` again, set `status=PENDING` → reload `/verify/...` → "Badge non valide".

Document the manual checklist as completed (boxes ticked) in the PR description.

- [ ] **Step 19.4: Confirm git log**

```bash
git log --oneline | head -25
```

Expected: a clean series of `feat(v2)` / `test(v2)` / `docs(v2)` commits since the start of Plan 5.

---

## Done

Plan 5 (inscription publique scopée) is complete. The whole unauthenticated surface — public event page, registration POST, badge verification, edit flow with snapshot, resend with cooldown, two-phase upload, rate limit, reCAPTCHA, blocklists, quotas — is wired up and covered by unit + integration tests. Branding and contact are resolved via the cascade.

**Next plan:** [Plan 6 — Notifications email multi-tenant](2026-05-28-v2-06-notifications-email.md) — wires `sendRegistrationConfirmation`, `sendEditLinkEmail`, `sendRegistrationApproved`, `sendRegistrationRejected`, replacing the stubs added in Tasks 9, 11, 12 of this plan.
