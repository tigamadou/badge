import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
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

type Fixture = Awaited<ReturnType<typeof setup>>;

function body(over: Record<string, unknown>, fixture: Fixture) {
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

afterEach(async () => {
  await fs.rm(path.join(process.cwd(), "uploads", "events"), {
    recursive: true,
    force: true,
  });
});

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
    expect(reg?.id).toMatch(/^\d{13}$/);
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
