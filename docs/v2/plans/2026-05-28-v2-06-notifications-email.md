# Notifications email multi-tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `src/lib/mail.ts` pour la v2 multi-tenant : lecture SMTP directe depuis `PlatformSettings` (pas de cascade), résolveur de branding contextuel (logo, contact) en cascade `Event → Org → Platform`, templates HTML français accentués avec branding event/org, et un jeu complet de fonctions d'envoi (confirmation, statut, badge imprimé, lien d'édition, invitation utilisateur, reset mot de passe, test SMTP).

**Architecture:** Une fonction centrale `resolveTransporter(ctx)` construit un objet `ResolvedTransport` (transporter nodemailer + `from` formaté + branding) à partir de `getPlatformSmtp()` (config SMTP plateforme uniquement) et de `resolveSettings()` du Plan 1 pour le branding (logo, contact). Un helper `buildEmail({ title, body, ctx })` rend le HTML inline commun (header logo, footer contact). Chaque fonction publique charge l'entité (Registration/User), détermine le contexte (`eventId` ou `orgId`), résout le transport et envoie. Les variables utilisateur sont systématiquement HTML-escapées (anti-XSS). Les échecs d'envoi loggent une erreur sans casser la transaction métier appelante.

**Tech Stack:** nodemailer (déjà dans `package.json`), Prisma 6, TypeScript 5, Vitest 4. SMTP de dev : Mailpit (`mailpit:1025`).

**Spec:** [docs/v2/features/notifications-email.md](../../v2/features/notifications-email.md)

> **Mise à jour 2026-05-31 — Décision de design SMTP plateforme uniquement.** Les paramètres SMTP (`smtpHost`, `smtpPort`, `smtpFrom`, `smtpUser`, `smtpPassword`, `smtpSecure`) vivent **uniquement** dans `PlatformSettings`. Il n'y a plus de cascade SMTP ni de champs SMTP sur `OrgSettings`/`EventSettings`. Seul le **branding** contextuel (logo via `Event.logo`, `contactEmail`, `contactPhone`) reste résolu en cascade `Event → Org → Platform`. Le `from` est toujours celui de la plateforme, éventuellement labellisé avec le nom de l'org ou de l'event pour l'expéditeur affiché. Voir `docs/v2/features/notifications-email.md` (source de vérité) pour la justification complète. Les tasks 2 et 10 ci-dessous ont été adaptées en conséquence.

---

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [ ] | -- | -- |
| 1 | [ ] | -- | -- |
| 2 | [ ] | -- | -- |
| 3 | [ ] | -- | -- |
| 4 | [ ] | -- | -- |
| 5 | [ ] | -- | -- |
| 6 | [ ] | -- | -- |
| 7 | [ ] | -- | -- |
| 8 | [ ] | -- | -- |
| 9 | [ ] | -- | -- |
| 10 | [ ] | -- | -- |
| 11 | [ ] | -- | -- |
| 12 | [ ] | -- | -- |

**Derniere session** : aucune, plan jamais commence.
**Prochaine etape** : Task 1.

**Notes** :
- **2026-05-31** — Decision de design : SMTP plateforme uniquement (pas de cascade). Les champs SMTP sont retires de `OrgSettings`/`EventSettings`. Tasks 2 et 10 adaptees (resolveTransporter lit directement `PlatformSettings` via `getPlatformSmtp()` ; le branding contextuel reste cascade Event -> Org -> Platform). Voir spec `docs/v2/features/notifications-email.md`.

---

## File Structure

**Files to create:**

- `src/lib/mail.ts` (full rewrite — remplace le module v1)
- `src/lib/__tests__/mail.test.ts` (suite Vitest complète)
- `src/lib/__tests__/mail-helpers.test.ts` (tests unitaires des helpers purs)

**Files to modify:**

- aucune autre — les routes API qui consomment `mail.ts` seront mises à jour dans les plans 2-5

**Tests** : tous dans `src/lib/__tests__/` (convention v1 préservée).

---

## Pre-flight

### Task 0: Verify environment

- [ ] **Step 0.1: Confirm branch and clean tree**

```bash
git status && git branch --show-current
```

Expected: `On branch feat/v2-sass`, working tree clean ou seuls les fichiers de ce plan modifiés.

- [ ] **Step 0.2: Confirm Plan 1 acquis disponibles**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/settings.test.ts src/lib/__tests__/activity-log.test.ts
```

Expected: tests Plan 1 passent. Ce plan dépend de `resolveSettings()`, `logActivity()`, du schéma v2 (User, Registration, Event, Organization, PlatformSettings, OrgSettings, EventSettings).

- [ ] **Step 0.3: Confirm nodemailer présent**

```bash
docker compose -f docker-compose.dev.yml exec app node -e "console.log(require('nodemailer/package.json').version)"
```

Expected: une version (ex `6.x.x`). Si absent : `docker compose -f docker-compose.dev.yml exec app yarn add nodemailer && yarn add -D @types/nodemailer`.

---

## Task 1: Helpers purs — escape HTML, formatage `from`, formatage date

**Files:**
- Create: `src/lib/mail-helpers.ts` (fonctions pures, sans IO)
- Create: `src/lib/__tests__/mail-helpers.test.ts`

> On isole les helpers purs pour pouvoir les tester sans Prisma ni nodemailer.

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/__tests__/mail-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { escapeHtml, formatFromAddress, formatFrenchDate, buildBaseUrl } from "@/lib/mail-helpers";

describe("escapeHtml", () => {
  it("escapes <, >, &, \", '", () => {
    expect(escapeHtml('<script>alert("x&y")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;"
    );
  });
  it("preserves french accents", () => {
    expect(escapeHtml("éèàçîôû")).toBe("éèàçîôû");
  });
  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("escapes single quote", () => {
    expect(escapeHtml("d'Ivoire")).toBe("d&#39;Ivoire");
  });
});

describe("formatFromAddress", () => {
  it("returns smtpFrom as-is when no label", () => {
    expect(formatFromAddress("noreply@badge.local", null)).toBe("noreply@badge.local");
  });
  it("formats with label when label provided", () => {
    expect(formatFromAddress("noreply@x.com", "Org Acme")).toBe('"Org Acme" <noreply@x.com>');
  });
  it("escapes quotes in label", () => {
    expect(formatFromAddress("a@b.com", 'Org "Acme"')).toBe('"Org \\"Acme\\"" <a@b.com>');
  });
  it("returns smtpFrom unchanged when smtpFrom already has format `Name <email>`", () => {
    expect(formatFromAddress("Badge <noreply@badge.local>", null)).toBe("Badge <noreply@badge.local>");
  });
});

describe("formatFrenchDate", () => {
  it("formats a date in french long form", () => {
    expect(formatFrenchDate(new Date("2026-05-28T10:00:00Z"))).toMatch(/28 mai 2026/);
  });
});

describe("buildBaseUrl", () => {
  it("uses BASE_URL when defined", () => {
    expect(buildBaseUrl({ BASE_URL: "https://x.example", NEXTAUTH_URL: "" })).toBe("https://x.example");
  });
  it("falls back to NEXTAUTH_URL", () => {
    expect(buildBaseUrl({ BASE_URL: "", NEXTAUTH_URL: "https://n.example" })).toBe("https://n.example");
  });
  it("defaults to http://localhost:3000 when both empty", () => {
    expect(buildBaseUrl({ BASE_URL: "", NEXTAUTH_URL: "" })).toBe("http://localhost:3000");
  });
  it("trims trailing slash", () => {
    expect(buildBaseUrl({ BASE_URL: "https://x/", NEXTAUTH_URL: "" })).toBe("https://x");
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail-helpers.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/mail-helpers'`.

- [ ] **Step 1.3: Implement `src/lib/mail-helpers.ts`**

```typescript
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  if (!input) return "";
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

// En v2, `smtpFrom` est toujours celui de PlatformSettings (pas de cascade SMTP).
// Le `label` optionnel sert uniquement a habiller l'expediteur affiche avec le nom
// de l'org ou de l'event courant (branding contextuel), sans changer l'adresse reelle.
export function formatFromAddress(smtpFrom: string, label: string | null): string {
  if (!label) return smtpFrom;
  // si smtpFrom contient déjà un label "Name <email>", on respecte
  if (smtpFrom.includes("<") && smtpFrom.includes(">")) return smtpFrom;
  const escapedLabel = label.replace(/"/g, '\\"');
  return `"${escapedLabel}" <${smtpFrom}>`;
}

export function formatFrenchDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function buildBaseUrl(env: { BASE_URL?: string; NEXTAUTH_URL?: string }): string {
  const raw = env.BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail-helpers.test.ts
```

Expected: 12 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/mail-helpers.ts src/lib/__tests__/mail-helpers.test.ts
git commit -m "feat(v2): helpers purs mail (escapeHtml, formatFromAddress, formatFrenchDate)"
```

---

## Task 2: `resolveTransporter` — construit le transporter et le branding contextuel

**Files:**
- Create: `src/lib/mail.ts` (premier squelette avec `resolveTransporter` uniquement)
- Create: `src/lib/__tests__/mail.test.ts`

> On démarre `mail.ts` avec uniquement `resolveTransporter` + `ResolvedTransport`. Les fonctions d'envoi viendront en Tasks 4-9.

- [ ] **Step 2.1: Write failing tests for `resolveTransporter`**

Create `src/lib/__tests__/mail.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveTransporter } from "@/lib/mail";

async function resetSettings() {
  await prisma.eventSettings.deleteMany();
  await prisma.orgSettings.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
    },
  });
}

describe("resolveTransporter", () => {
  beforeEach(async () => {
    await resetSettings();
  });

  it("returns platform from when no context", async () => {
    const r = await resolveTransporter({});
    expect(r.from).toBe("noreply@badge.local");
    expect(r.contactEmail).toBe("");
    expect(r.contactPhone).toBe("");
    expect(r.eventTitle).toBeUndefined();
    expect(r.orgName).toBeUndefined();
    expect(r.logoUrl).toBeUndefined();
  });

  it("labels platform from with org name when orgId provided", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Acme", slug: "acme" } });
    await prisma.orgSettings.create({
      data: { orgId: org.id, contactEmail: "c@acme.com", contactPhone: "+225 0101" },
    });
    const r = await resolveTransporter({ orgId: org.id });
    // L'adresse reste celle de PlatformSettings ; seul le label affiche change
    expect(r.from).toBe('"Org Acme" <noreply@badge.local>');
    expect(r.contactEmail).toBe("c@acme.com");
    expect(r.contactPhone).toBe("+225 0101");
    expect(r.orgName).toBe("Org Acme");
  });

  it("labels platform from with event title when eventId provided", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Acme", slug: "acme2" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon 2026", slug: "salon-2026", location: "Abidjan", date: new Date() },
    });
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "salon@acme.com", contactPhone: "+225 0202" },
    });
    const r = await resolveTransporter({ eventId: event.id });
    // L'adresse reste celle de PlatformSettings ; seul le label affiche change
    expect(r.from).toBe('"Salon 2026" <noreply@badge.local>');
    expect(r.eventTitle).toBe("Salon 2026");
    expect(r.orgName).toBe("Org Acme");
  });

  it("uses raw platform from when no context", async () => {
    const org = await prisma.organization.create({ data: { name: "Org X", slug: "x1" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Evt X", slug: "evt-x1", location: "L", date: new Date() },
    });
    const r = await resolveTransporter({ eventId: event.id });
    // Quand un event existe, on labellise quand meme avec son titre
    expect(r.from).toBe('"Evt X" <noreply@badge.local>');
  });

  it("includes logo URL when event has logo", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "withlogo" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: "evt-logo",
        location: "L",
        date: new Date(),
        logo: "abc-logo.png",
      },
    });
    const r = await resolveTransporter({ eventId: event.id });
    expect(r.logoUrl).toMatch(/\/api\/files\/abc-logo\.png$/);
  });

  it("builds nodemailer transporter with correct host/port", async () => {
    const r = await resolveTransporter({});
    expect(typeof r.transporter.sendMail).toBe("function");
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/mail'` (le v1 sera écrasé).

- [ ] **Step 2.3: Implement `src/lib/mail.ts` (squelette)**

```typescript
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { resolveSettings, getPlatformSmtp, type ResolvedSettings } from "@/lib/settings";
import { buildBaseUrl, formatFromAddress } from "@/lib/mail-helpers";

export type TransportContext = {
  eventId?: string;
  orgId?: string;
};

export type ResolvedTransport = {
  transporter: Transporter;
  from: string;
  contactEmail: string;
  contactPhone: string;
  eventTitle?: string;
  orgName?: string;
  logoUrl?: string;
  settings: ResolvedSettings;
};

// Branding contextuel uniquement (logo + nom event/org). En v2 le SMTP est plateforme
// uniquement : on ne lit plus `smtpFrom` sur OrgSettings/EventSettings (champs supprimes).
// Le `fromLabel` sert a habiller l'expediteur affiche avec le nom de l'event ou de l'org.
async function loadBrandingContext(ctx: TransportContext): Promise<{
  eventTitle?: string;
  orgName?: string;
  logoUrl?: string;
  resolvedOrgId?: string;
  fromLabel: string | null;
}> {
  const baseUrl = buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL });

  if (ctx.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: ctx.eventId },
      select: {
        title: true,
        logo: true,
        orgId: true,
        organization: { select: { name: true } },
      },
    });
    if (event) {
      return {
        eventTitle: event.title,
        orgName: event.organization.name,
        logoUrl: event.logo ? `${baseUrl}/api/files/${event.logo}` : undefined,
        resolvedOrgId: event.orgId,
        fromLabel: event.title,
      };
    }
  }

  if (ctx.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { name: true },
    });
    if (org) {
      return {
        orgName: org.name,
        fromLabel: org.name,
        resolvedOrgId: ctx.orgId,
      };
    }
  }

  return { fromLabel: null };
}

export async function resolveTransporter(ctx: TransportContext): Promise<ResolvedTransport> {
  // SMTP plateforme uniquement (pas de cascade) — voir spec notifications-email.md (2026-05-31).
  const smtp = await getPlatformSmtp();
  // Branding (logo, contactEmail, contactPhone) reste cascade Event -> Org -> Platform.
  const settings = await resolveSettings(ctx.eventId, ctx.orgId);
  const branding = await loadBrandingContext(ctx);

  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost || "localhost",
    port: smtp.smtpPort || 587,
    secure: smtp.smtpSecure,
    ...(smtp.smtpUser && smtp.smtpPassword
      ? { auth: { user: smtp.smtpUser, pass: smtp.smtpPassword } }
      : {}),
  });

  const from = formatFromAddress(smtp.smtpFrom || "noreply@badge.local", branding.fromLabel);

  return {
    transporter,
    from,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    eventTitle: branding.eventTitle,
    orgName: branding.orgName,
    logoUrl: branding.logoUrl,
    settings,
  };
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 6 passed.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): resolveTransporter (SMTP plateforme + branding contextuel cascade)"
```

---

## Task 3: `buildEmail` — template HTML commun

**Files:**
- Modify: `src/lib/mail.ts` (ajout `buildEmail`)
- Modify: `src/lib/__tests__/mail.test.ts` (ajout du describe)

- [ ] **Step 3.1: Add failing tests in `mail.test.ts`**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
import { buildEmail } from "@/lib/mail";

describe("buildEmail", () => {
  it("renders title and body with logo and footer", () => {
    const html = buildEmail({
      title: "Bienvenue",
      body: "<p>Bonjour <strong>Amadou</strong></p>",
      ctx: {
        transporter: {} as any,
        from: "x@y",
        contactEmail: "c@x.com",
        contactPhone: "+225 0101",
        eventTitle: "Salon 2026",
        orgName: "Acme",
        logoUrl: "https://x/api/files/logo.png",
        settings: {} as any,
      },
    });
    expect(html).toContain("Bienvenue");
    expect(html).toContain("Bonjour <strong>Amadou</strong>");
    expect(html).toContain('src="https://x/api/files/logo.png"');
    expect(html).toContain("c@x.com");
    expect(html).toContain("+225 0101");
    expect(html).toContain("Salon 2026");
  });

  it("uses fallback Badge header when no eventTitle and no logo", () => {
    const html = buildEmail({
      title: "Notification",
      body: "<p>Test</p>",
      ctx: {
        transporter: {} as any,
        from: "x@y",
        contactEmail: "",
        contactPhone: "",
        settings: {} as any,
      },
    });
    expect(html).toContain("Badge");
    expect(html).not.toContain("img src=");
  });

  it("uses orgName as header when no eventTitle", () => {
    const html = buildEmail({
      title: "Invitation",
      body: "<p>Bonjour</p>",
      ctx: {
        transporter: {} as any,
        from: "x@y",
        contactEmail: "c@x",
        contactPhone: "",
        orgName: "Acme",
        settings: {} as any,
      },
    });
    expect(html).toContain("Acme");
  });

  it("includes lang=fr and utf-8 meta", () => {
    const html = buildEmail({
      title: "T",
      body: "<p>x</p>",
      ctx: { transporter: {} as any, from: "", contactEmail: "", contactPhone: "", settings: {} as any },
    });
    expect(html).toMatch(/lang="fr"/);
    expect(html).toMatch(/charset="utf-8"/i);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: les 4 nouveaux tests échouent (`buildEmail` non exporté).

- [ ] **Step 3.3: Implement `buildEmail` dans `src/lib/mail.ts`**

Add at the end of `src/lib/mail.ts`:

```typescript
export type BuildEmailArgs = {
  title: string;
  body: string; // HTML déjà composé/escaped par l'appelant
  ctx: ResolvedTransport;
};

export function buildEmail({ title, body, ctx }: BuildEmailArgs): string {
  const headerLabel = ctx.eventTitle || ctx.orgName || "Badge";

  const logoBlock = ctx.logoUrl
    ? `<img src="${ctx.logoUrl}" alt="${escapeAttr(headerLabel)}" style="max-height:64px;max-width:200px;margin-bottom:16px;" />`
    : "";

  const footerLines: string[] = [];
  if (ctx.contactEmail) {
    footerLines.push(
      `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">
  <a href="mailto:${escapeAttr(ctx.contactEmail)}" style="color:#94a3b8;text-decoration:none;">${escapeText(ctx.contactEmail)}</a>
</p>`
    );
  }
  if (ctx.contactPhone) {
    footerLines.push(
      `<p style="margin:0;color:#94a3b8;font-size:12px;">${escapeText(ctx.contactPhone)}</p>`
    );
  }
  if (footerLines.length === 0) {
    footerLines.push(
      `<p style="margin:0;color:#94a3b8;font-size:12px;">${escapeText(headerLabel)}</p>`
    );
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td align="center" style="background-color:#0f172a;padding:28px 24px;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.02em;">${escapeText(headerLabel)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 28px;border-top:1px solid #e2e8f0;">
              ${footerLines.join("\n")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// petits wrappers internes pour clarifier l'intention
function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch] ?? ch);
}

function escapeAttr(s: string): string {
  return escapeText(s);
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 10 passed (6 anciens + 4 nouveaux).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): buildEmail (template HTML commun avec branding event/org/Badge)"
```

---

## Task 4: `sendRegistrationConfirmation`

**Files:**
- Modify: `src/lib/mail.ts` (ajout fonction)
- Modify: `src/lib/__tests__/mail.test.ts` (nouveau describe)

> Cette fonction charge la `Registration` par id + relations event/category, résout le transport, compose le body et envoie. Pour tester l'envoi, on espionne `transporter.sendMail` via un mock partiel (on stub `resolveTransporter`).

- [ ] **Step 4.1: Helper de test — factoriser un mock transporter**

Append to `src/lib/__tests__/mail.test.ts` (en haut du fichier, après les imports existants) :

```typescript
import * as mailModule from "@/lib/mail";

type SentMail = { from: string; to: string; subject: string; html: string };

function mockTransport(sent: SentMail[] = []) {
  const transporter = {
    sendMail: vi.fn(async (opts: any) => {
      sent.push({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html });
      return { messageId: "test-" + sent.length };
    }),
  };
  return { transporter, sent };
}
```

Then append the new `describe`:

```typescript
describe("sendRegistrationConfirmation", () => {
  beforeEach(async () => {
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await resetSettings();
  });

  it("sends a confirmation email with event branding", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "rcacme" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon 2026", slug: "rc-salon", location: "Abidjan", date: new Date("2026-10-01") },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "Visiteur", color: "#000000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-001",
        eventId: event.id,
        categoryId: cat.id,
        email: "amadou@example.com",
        lastName: "Diallo",
        firstName: "Amadou",
        structure: "ENSEA",
        idDocumentType: "CNI",
        idDocumentNumber: "ABC123",
      },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: '"Salon 2026" <noreply@badge.local>',
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon 2026",
      orgName: "Acme",
      settings: {} as any,
    });

    await mailModule.sendRegistrationConfirmation(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("amadou@example.com");
    expect(sent[0].subject).toContain("Confirmation");
    expect(sent[0].subject).toContain("Salon 2026");
    expect(sent[0].html).toContain("Amadou");
    expect(sent[0].html).toContain("attente de validation");
  });

  it("escapes user-supplied names (anti-XSS)", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "rcxss" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "rc-xss", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-XSS",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "<script>alert(1)</script>",
        firstName: "Pwn",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
      },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    await mailModule.sendRegistrationConfirmation(reg.id);

    expect(sent[0].html).not.toContain("<script>alert(1)</script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });

  it("does nothing when registration not found (logs only)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendRegistrationConfirmation("missing-id");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: les 3 nouveaux tests échouent.

- [ ] **Step 4.3: Implement `sendRegistrationConfirmation` dans `src/lib/mail.ts`**

Append:

```typescript
import { formatFrenchDate } from "@/lib/mail-helpers";

async function safeSend(args: {
  to: string;
  subject: string;
  html: string;
  ctx: ResolvedTransport;
}): Promise<void> {
  try {
    await args.ctx.transporter.sendMail({
      from: args.ctx.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
  } catch (err) {
    console.error("[mail] sendMail failed", {
      to: args.to,
      subject: args.subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendRegistrationConfirmation(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      eventId: true,
      event: { select: { title: true, date: true, location: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendRegistrationConfirmation: registration not found", { registrationId });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.firstName} ${reg.lastName}`);
  const eventTitle = escapeText(reg.event.title);
  const eventDate = formatFrenchDate(reg.event.date);
  const eventLocation = escapeText(reg.event.location);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre inscription à <strong>${eventTitle}</strong> (${escapeText(eventDate)}, ${eventLocation}) a bien été reçue. Elle est en attente de validation.</p>
    <p style="margin:0;">Vous recevrez un email dès que votre inscription sera traitée.</p>
  `;

  await safeSend({
    to: reg.email,
    subject: `Confirmation d'inscription — ${reg.event.title}`,
    html: buildEmail({ title: `Confirmation d'inscription`, body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 13 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendRegistrationConfirmation (email participant a l'inscription)"
```

---

## Task 5: `sendStatusNotification` — dispatcher APPROVED/REJECTED

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

- [ ] **Step 5.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendStatusNotification", () => {
  beforeEach(async () => {
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await resetSettings();
  });

  async function makeReg(status: "APPROVED" | "REJECTED", extra: any = {}) {
    const org = await prisma.organization.create({ data: { name: "O", slug: `sn-${status}-${Date.now()}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: `sn-evt-${Date.now()}`, location: "Abidjan", date: new Date("2026-10-01") },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    return prisma.registration.create({
      data: {
        id: `REG-${status}-${Date.now()}`,
        eventId: event.id,
        categoryId: cat.id,
        email: "x@example.com",
        lastName: "Diallo",
        firstName: "Amadou",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        status,
        ...extra,
      },
    });
  }

  it("sends approval email when status is APPROVED", async () => {
    const reg = await makeReg("APPROVED");
    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as any,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("approuvée");
    expect(sent[0].html).toContain("approuvée");
  });

  it("sends rejection email with reason and edit link", async () => {
    const reg = await makeReg("REJECTED", {
      rejectionReason: "Photo illisible",
      rejectionDetails: "Veuillez fournir une photo nette",
      editToken: "tok-123",
      editTokenExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    });
    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as any,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("rejetée");
    expect(sent[0].html).toContain("Photo illisible");
    expect(sent[0].html).toContain("Veuillez fournir une photo nette");
    expect(sent[0].html).toContain("/edit-registration/tok-123");
    expect(sent[0].html).toContain("48 heures");
  });

  it("does nothing when status is PENDING", async () => {
    const reg = await makeReg("REJECTED");
    await prisma.registration.update({ where: { id: reg.id }, data: { status: "PENDING" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendStatusNotification(reg.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[mail]"), expect.anything());
    consoleSpy.mockRestore();
  });

  it("escapes rejection details (anti-XSS)", async () => {
    const reg = await makeReg("REJECTED", {
      rejectionReason: "<img src=x onerror=alert(1)>",
      rejectionDetails: "<b>bold</b>",
    });
    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent[0].html).not.toContain("<img src=x");
    expect(sent[0].html).toContain("&lt;img");
    expect(sent[0].html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: les 4 nouveaux tests échouent.

- [ ] **Step 5.3: Implement `sendStatusNotification`**

Append to `src/lib/mail.ts`:

```typescript
export async function sendStatusNotification(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      rejectionReason: true,
      rejectionDetails: true,
      editToken: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });

  if (!reg) {
    console.error("[mail] sendStatusNotification: registration not found", { registrationId });
    return;
  }

  if (reg.status !== "APPROVED" && reg.status !== "REJECTED") {
    console.error("[mail] sendStatusNotification: status not eligible", { registrationId, status: reg.status });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.firstName} ${reg.lastName}`);
  const eventTitle = escapeText(reg.event.title);

  if (reg.status === "APPROVED") {
    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Votre inscription à <strong>${eventTitle}</strong> a été <span style="color:#059669;font-weight:600;">approuvée</span>.</p>
      <p style="margin:0;">Votre badge sera disponible le jour de l'événement.</p>
    `;
    await safeSend({
      to: reg.email,
      subject: `Votre inscription à ${reg.event.title} est approuvée`,
      html: buildEmail({ title: "Inscription approuvée", body, ctx }),
      ctx,
    });
    return;
  }

  // REJECTED
  const baseUrl = buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL });
  const reasonBlock = reg.rejectionReason
    ? `<p style="margin:0 0 8px;"><strong>Motif :</strong> ${escapeText(reg.rejectionReason)}</p>`
    : "";
  const detailsBlock = reg.rejectionDetails
    ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">${escapeText(reg.rejectionDetails)}</p>`
    : "";
  const editBlock = reg.editToken
    ? `<p style="margin:0 0 24px;text-align:center;">
        <a href="${baseUrl}/edit-registration/${encodeURIComponent(reg.editToken)}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Modifier et resoumettre mon inscription</a>
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>`
    : "";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Nous sommes désolés, votre inscription à <strong>${eventTitle}</strong> a été <span style="color:#e11d48;font-weight:600;">rejetée</span>.</p>
    ${reasonBlock}
    ${detailsBlock}
    ${editBlock}
    <p style="margin:0;">Pour plus d'informations, veuillez contacter l'organisation.</p>
  `;

  await safeSend({
    to: reg.email,
    subject: `Inscription rejetée — ${reg.event.title}`,
    html: buildEmail({ title: "Inscription rejetée", body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 17 passed.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendStatusNotification (dispatcher APPROVED/REJECTED + lien d'edition)"
```

---

## Task 6: `sendBadgePrintedNotification`

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

- [ ] **Step 6.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendBadgePrintedNotification", () => {
  beforeEach(async () => {
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await resetSettings();
  });

  it("sends badge printed email with verify link", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "bpacme" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: "bp-salon", location: "Abidjan", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-BP",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x.com",
        lastName: "Diallo",
        firstName: "Amadou",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        badgePrinted: true,
        badgePrintedAt: new Date(),
      },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "c@org.com",
      contactPhone: "+225 0101",
      eventTitle: "Salon",
      settings: {} as any,
    });

    await mailModule.sendBadgePrintedNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Badge");
    expect(sent[0].html).toContain("Amadou");
    expect(sent[0].html).toContain("pièce d'identité");
    expect(sent[0].html).toContain("c@org.com");
    expect(sent[0].html).toContain("+225 0101");
  });

  it("skips email when badgePrinted is false", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "bp-no" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "S", slug: "bp-evt-no", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-BP-NO",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        badgePrinted: false,
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendBadgePrintedNotification(reg.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[mail]"), expect.anything());
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 2 nouveaux tests échouent.

- [ ] **Step 6.3: Implement `sendBadgePrintedNotification`**

Append to `src/lib/mail.ts`:

```typescript
export async function sendBadgePrintedNotification(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      badgePrinted: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendBadgePrintedNotification: registration not found", { registrationId });
    return;
  }
  if (!reg.badgePrinted) {
    console.error("[mail] sendBadgePrintedNotification: badge not yet printed", { registrationId });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.firstName} ${reg.lastName}`);

  const contactBlock = ctx.contactEmail || ctx.contactPhone
    ? `
      <p style="margin:16px 0 8px;">Pour toute question concernant le retrait :</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
        ${ctx.contactEmail ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Email :</td><td style="padding:4px 0 4px 8px;"><a href="mailto:${escapeAttr(ctx.contactEmail)}" style="color:#4f46e5;text-decoration:none;">${escapeText(ctx.contactEmail)}</a></td></tr>` : ""}
        ${ctx.contactPhone ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Tél :</td><td style="padding:4px 0 4px 8px;color:#334155;">${escapeText(ctx.contactPhone)}</td></tr>` : ""}
      </table>
    `
    : "";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre badge pour <strong>${escapeText(reg.event.title)}</strong> a été imprimé et est prêt à être retiré.</p>
    <p style="margin:0 0 16px;">Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
    ${contactBlock}
  `;

  await safeSend({
    to: reg.email,
    subject: `Badge prêt — ${reg.event.title}`,
    html: buildEmail({ title: "Votre badge est prêt", body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 19 passed.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendBadgePrintedNotification (mail badge pret au retrait)"
```

---

## Task 7: `sendEditLinkEmail` — génération + envoi du lien d'édition

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

> Le lien d'édition est un `editToken` aléatoire (32 bytes hex) avec expiration 48h. La fonction génère le token, le sauvegarde sur la `Registration`, puis envoie le mail.

- [ ] **Step 7.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendEditLinkEmail", () => {
  beforeEach(async () => {
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await resetSettings();
  });

  it("generates a token, persists it with 48h expiry, and sends the email", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "elacme" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: "el-salon", location: "Abidjan", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-EL",
        eventId: event.id,
        categoryId: cat.id,
        email: "edit@x.com",
        lastName: "Diallo",
        firstName: "Amadou",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
      },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as any,
    });

    const before = Date.now();
    await mailModule.sendEditLinkEmail(reg.id);
    const after = Date.now();

    const updated = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.editToken).toMatch(/^[a-f0-9]{64}$/);
    expect(updated?.editTokenExpiresAt).toBeInstanceOf(Date);
    const diffHours = (updated!.editTokenExpiresAt!.getTime() - before) / 3600 / 1000;
    expect(diffHours).toBeGreaterThanOrEqual(47.9);
    expect(diffHours).toBeLessThanOrEqual(48.1);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("edit@x.com");
    expect(sent[0].html).toContain(`/edit-registration/${updated!.editToken}`);
    expect(sent[0].html).toContain("48 heures");
  });

  it("regenerates a new token on each call", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "elacme2" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "S", slug: "el-s2", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "REG-EL-2",
        eventId: event.id,
        categoryId: cat.id,
        email: "e@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        editToken: "old-token",
        editTokenExpiresAt: new Date(Date.now() - 1000),
      },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    await mailModule.sendEditLinkEmail(reg.id);

    const updated = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.editToken).not.toBe("old-token");
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 2 nouveaux tests échouent.

- [ ] **Step 7.3: Implement `sendEditLinkEmail`**

Append to `src/lib/mail.ts` (et ajouter l'import de `crypto` en tête de fichier si absent) :

```typescript
import { randomBytes } from "crypto";

export async function sendEditLinkEmail(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendEditLinkEmail: registration not found", { registrationId });
    return;
  }

  const editToken = randomBytes(32).toString("hex");
  const editTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  await prisma.registration.update({
    where: { id: registrationId },
    data: { editToken, editTokenExpiresAt },
  });

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.firstName} ${reg.lastName}`);
  const baseUrl = buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL });

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Voici un nouveau lien pour modifier et resoumettre votre inscription à <strong>${escapeText(reg.event.title)}</strong> :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/edit-registration/${editToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Modifier mon inscription</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>
  `;

  await safeSend({
    to: reg.email,
    subject: `Modifier votre inscription — ${reg.event.title}`,
    html: buildEmail({ title: "Modifier votre inscription", body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 21 passed.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendEditLinkEmail (generation token 48h + mail au participant)"
```

---

## Task 8: `sendUserInvitation` — invitation utilisateur interne

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

> Génère un `inviteToken` (24h) sur le `User`, puis envoie un mail. Le contexte peut être : staff (pas d'orgId), OWNER d'org (orgId), membership event (orgId).

- [ ] **Step 8.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendUserInvitation", () => {
  beforeEach(async () => {
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await resetSettings();
  });

  it("generates a 24h invite token and sends setup link (no org context)", async () => {
    const user = await prisma.user.create({
      data: { email: "newstaff@badge.local", password: "tmp", name: "New Staff" },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    const before = Date.now();
    await mailModule.sendUserInvitation(user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.inviteToken).toMatch(/^[a-f0-9]{64}$/);
    const diffHours = (updated!.inviteTokenExpiry!.getTime() - before) / 3600 / 1000;
    expect(diffHours).toBeGreaterThanOrEqual(23.9);
    expect(diffHours).toBeLessThanOrEqual(24.1);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("newstaff@badge.local");
    expect(sent[0].subject).toContain("Bienvenue sur Badge");
    expect(sent[0].html).toContain(`/setup-password?token=${updated!.inviteToken}`);
    expect(sent[0].html).toContain("24 heures");
    expect(sent[0].html).toContain("New Staff");
  });

  it("includes the org name when orgId provided", async () => {
    const user = await prisma.user.create({
      data: { email: "owner@acme.com", password: "tmp", name: "Owner Acme" },
    });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "ui-acme" } });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: '"Acme" <x@y>',
      contactEmail: "",
      contactPhone: "",
      orgName: "Acme",
      settings: {} as any,
    });

    await mailModule.sendUserInvitation(user.id, { orgId: org.id });

    expect(sent[0].html).toContain("Acme");
  });

  it("escapes the user name", async () => {
    const user = await prisma.user.create({
      data: { email: "xss@x.com", password: "tmp", name: "<script>x</script>" },
    });
    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });
    await mailModule.sendUserInvitation(user.id);
    expect(sent[0].html).not.toContain("<script>x</script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 3 nouveaux tests échouent.

- [ ] **Step 8.3: Implement `sendUserInvitation`**

Append to `src/lib/mail.ts`:

```typescript
export async function sendUserInvitation(
  userId: string,
  options?: { orgId?: string }
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendUserInvitation: user not found", { userId });
    return;
  }

  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });

  const ctx = await resolveTransporter({ orgId: options?.orgId });
  const baseUrl = buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL });
  const safeName = escapeText(user.name);
  const orgClause = ctx.orgName
    ? ` pour l'organisation <strong>${escapeText(ctx.orgName)}</strong>`
    : "";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Un compte vient d'être créé pour vous sur Badge${orgClause}.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/setup-password?token=${inviteToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Définir mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 24 heures.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Bienvenue sur Badge",
    html: buildEmail({ title: "Bienvenue sur Badge", body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 24 passed.

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendUserInvitation (invite 24h + lien setup-password)"
```

---

## Task 9: `sendPasswordResetEmail` — reset par staff

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

> Identique au flow invitation : on reset le `inviteToken` (24h) et on envoie un mail "Réinitialisation de votre mot de passe".

- [ ] **Step 9.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendPasswordResetEmail", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("generates a 24h token and sends a reset link", async () => {
    const user = await prisma.user.create({
      data: { email: "reset@x.com", password: "old", name: "Reset User" },
    });

    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    await mailModule.sendPasswordResetEmail(user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.inviteToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Réinitialisation");
    expect(sent[0].html).toContain(`/setup-password?token=${updated!.inviteToken}`);
    expect(sent[0].html).toContain("24 heures");
  });

  it("returns when user not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendPasswordResetEmail("missing-user");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[mail]"), expect.anything());
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 9.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 2 nouveaux tests échouent.

- [ ] **Step 9.3: Implement `sendPasswordResetEmail`**

Append to `src/lib/mail.ts`:

```typescript
export async function sendPasswordResetEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendPasswordResetEmail: user not found", { userId });
    return;
  }

  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });

  const ctx = await resolveTransporter({});
  const baseUrl = buildBaseUrl({ BASE_URL: process.env.BASE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL });
  const safeName = escapeText(user.name);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Une réinitialisation de votre mot de passe a été déclenchée pour votre compte Badge.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/setup-password?token=${inviteToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe",
    html: buildEmail({ title: "Réinitialisation du mot de passe", body, ctx }),
    ctx,
  });
}
```

- [ ] **Step 9.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 26 passed.

- [ ] **Step 9.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendPasswordResetEmail (reset declenche par staff, token 24h)"
```

---

## Task 10: `sendSmtpTest` — utilisé par les UI staff/org/event

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/__tests__/mail.test.ts`

> Cette fonction permet aux écrans de configuration (Plans 2/3/4) de vérifier qu'un envoi fonctionne avec les settings actuels. Elle accepte `{ to, orgId?, eventId? }` et envoie un mail "Test SMTP — Badge" via le contexte demandé.

- [ ] **Step 10.1: Add failing tests**

Append to `src/lib/__tests__/mail.test.ts`:

```typescript
describe("sendSmtpTest", () => {
  beforeEach(async () => {
    await resetSettings();
  });

  it("sends test email with platform context", async () => {
    const { transporter, sent } = mockTransport();
    vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: "noreply@badge.local",
      contactEmail: "",
      contactPhone: "",
      settings: {} as any,
    });

    await mailModule.sendSmtpTest({ to: "tester@x.com" });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("tester@x.com");
    expect(sent[0].subject).toBe("Test SMTP — Badge");
    expect(sent[0].html).toContain("test");
  });

  it("uses org context for branding when orgId provided (SMTP stays platform)", async () => {
    const org = await prisma.organization.create({ data: { name: "OrgT", slug: "test-smtp-org" } });
    // En v2 SMTP est plateforme uniquement : pas de smtpFrom sur OrgSettings.
    // On verifie que le `from` est l'adresse plateforme, simplement labellisee avec le nom de l'org.
    const { transporter, sent } = mockTransport();
    const spy = vi.spyOn(mailModule, "resolveTransporter").mockResolvedValueOnce({
      transporter: transporter as any,
      from: '"OrgT" <noreply@badge.local>',
      contactEmail: "",
      contactPhone: "",
      orgName: "OrgT",
      settings: {} as any,
    });

    await mailModule.sendSmtpTest({ to: "x@y.com", orgId: org.id });

    expect(spy).toHaveBeenCalledWith({ orgId: org.id, eventId: undefined });
    // Adresse plateforme conservee, label = nom de l'org
    expect(sent[0].from).toBe('"OrgT" <noreply@badge.local>');
    // Le sujet/branding du message peut etre contextualise a l'org, mais l'expediteur reste plateforme
    expect(sent[0].html).toContain("OrgT");
  });

  it("rejects invalid email", async () => {
    await expect(mailModule.sendSmtpTest({ to: "not-an-email" })).rejects.toThrow(/email/i);
  });
});
```

- [ ] **Step 10.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 3 nouveaux tests échouent.

- [ ] **Step 10.3: Implement `sendSmtpTest`**

Append to `src/lib/mail.ts`:

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendSmtpTest(args: {
  to: string;
  orgId?: string;
  eventId?: string;
}): Promise<void> {
  if (!EMAIL_REGEX.test(args.to)) {
    throw new Error(`Invalid email address: ${args.to}`);
  }

  const ctx = await resolveTransporter({ orgId: args.orgId, eventId: args.eventId });

  const scopeLabel = ctx.eventTitle
    ? `événement <strong>${escapeText(ctx.eventTitle)}</strong>`
    : ctx.orgName
      ? `organisation <strong>${escapeText(ctx.orgName)}</strong>`
      : "plateforme <strong>Badge</strong>";

  const body = `
    <p style="margin:0 0 16px;">Ceci est un email de test envoyé depuis Badge.</p>
    <p style="margin:0 0 16px;">Configuration testée : ${scopeLabel}.</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Si vous recevez ce message, votre configuration SMTP est opérationnelle.</p>
    <p style="margin:0;color:#94a3b8;font-size:12px;">Expéditeur : ${escapeText(ctx.from)}</p>
  `;

  // sendSmtpTest est appelé depuis les UI : on veut propager les erreurs au lieu de les avaler
  await ctx.transporter.sendMail({
    from: ctx.from,
    to: args.to,
    subject: "Test SMTP — Badge",
    html: buildEmail({ title: "Test SMTP", body, ctx }),
  });
}
```

- [ ] **Step 10.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts
```

Expected: 29 passed.

- [ ] **Step 10.5: Commit**

```bash
git add src/lib/mail.ts src/lib/__tests__/mail.test.ts
git commit -m "feat(v2): sendSmtpTest (test SMTP depuis UI staff/org/event)"
```

---

## Task 11: Vérification finale et lint/typecheck

- [ ] **Step 11.1: Run full mail test suite**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts src/lib/__tests__/mail-helpers.test.ts
```

Expected: 41 passed (12 helpers + 29 mail).

- [ ] **Step 11.2: Run full Vitest suite (no regression on Plan 1)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run
```

Expected: tous les tests passent (Plan 1 + Plan 6).

- [ ] **Step 11.3: Typecheck**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | grep "src/lib/mail" || echo "OK"
```

Expected: pas d'erreur dans `src/lib/mail.ts` ni `src/lib/mail-helpers.ts`. Des erreurs restantes dans `src/app/**` sont normales (héritage v1, résolues par Plans 2-5).

- [ ] **Step 11.4: Lint**

```bash
docker compose -f docker-compose.dev.yml exec app yarn eslint src/lib/mail.ts src/lib/mail-helpers.ts src/lib/__tests__/mail.test.ts src/lib/__tests__/mail-helpers.test.ts
```

Expected: 0 erreur, 0 warning.

- [ ] **Step 11.5: Smoke test manuel via Mailpit**

Avec un script ad-hoc :

```bash
docker compose -f docker-compose.dev.yml exec app node -e "
require('ts-node/register');
(async () => {
  const { sendSmtpTest } = await import('./src/lib/mail.ts');
  await sendSmtpTest({ to: 'smoke@badge.local' });
  console.log('sent');
})();
" 2>&1 | tail
```

Puis ouvrir `http://localhost:8025` (Mailpit) et vérifier visuellement :
- Sujet `Test SMTP — Badge`
- Corps avec accents corrects (`opérationnelle`, `événement`)
- Header `Badge`
- Pas de balise script ni de variable non-résolue (`{{...}}`)

> Si `ts-node` n'est pas dispo, sauter cette étape — la suite Vitest couvre déjà l'envoi en bouchon.

- [ ] **Step 11.6: Verify no leak of secrets**

```bash
grep -E "smtpPassword|recaptchaSecretKey" src/lib/mail.ts || echo "OK: no secret reference"
```

Expected: une seule référence à `smtpPassword` dans `resolveTransporter` (pour configurer l'auth nodemailer), aucune autre. Aucun usage dans `buildEmail` ni dans les bodies.

- [ ] **Step 11.7: Final commit (note d'avancement)**

Si des ajustements de typage ou de lint ont été nécessaires :

```bash
git add -A src/lib/mail.ts src/lib/mail-helpers.ts src/lib/__tests__/mail.test.ts src/lib/__tests__/mail-helpers.test.ts
git status
# si modifications restent
git commit -m "chore(v2): finitions lint/typecheck mail.ts"
```

Sinon, ne pas créer de commit vide.

- [ ] **Step 11.8: Confirm git log**

```bash
git log --oneline | head -15
```

Expected: une série de commits `feat(v2): ...` correspondant aux Tasks 1 à 10.

---

## Task 12: Documentation

**Files:**
- Modify: `docs/v2/features/notifications-email.md` (note de complétion en bas)

- [ ] **Step 12.1: Append completion note**

À la fin de `docs/v2/features/notifications-email.md`, ajouter :

```markdown
## État d'implémentation

Plan 6 implémenté (`docs/v2/plans/2026-05-28-v2-06-notifications-email.md`). Module `src/lib/mail.ts` réécrit, suite Vitest dans `src/lib/__tests__/mail.test.ts` et `src/lib/__tests__/mail-helpers.test.ts`. Les routes API qui consomment ces fonctions sont mises à jour dans les plans 2 à 5.
```

- [ ] **Step 12.2: Commit**

```bash
git add docs/v2/features/notifications-email.md
git commit -m "docs(v2): note de completion Plan 6 (notifications email)"
```

---

## Done

Plan 6 (notifications email multi-tenant) est complet. `src/lib/mail.ts` est prêt à être consommé par :

- **Plan 2** (gestion staff) : `sendUserInvitation`, `sendSmtpTest`
- **Plan 3** (espace org OWNER) : `sendUserInvitation`, `sendSmtpTest`, `sendPasswordResetEmail`
- **Plan 4** (espace event ADMIN/OPERATOR) : `sendStatusNotification`, `sendBadgePrintedNotification`, `sendEditLinkEmail`, `sendSmtpTest`
- **Plan 5** (inscription publique + edit-link) : `sendRegistrationConfirmation`, `sendEditLinkEmail`

**Critères d'acceptation de la spec — couverture :**

1. Confirmation envoyée après création → Task 4
2. Email de rejet avec motif + lien 48h → Task 5
3. Logo event affiché → Task 3
4. Footer contact résolu en cascade → Tasks 2 + 3
5. Invitation user → lien `/setup-password?token=...` (24h) → Task 8
6. Test SMTP → Task 10
7. Accents + UTF-8 préservés → header `charset="utf-8"`, `lang="fr"` (Task 3) + tests d'accents (Task 1)
8. Aucun secret dans le corps → vérifié Task 11.6

**Next plan:** Plan 7 — Reset & déploiement initial.
