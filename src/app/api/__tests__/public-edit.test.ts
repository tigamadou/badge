import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/public/edit-registration/[token]/route";
import {
  POST as RESEND,
  resetEditResendCooldownForTests,
} from "@/app/api/public/edit-registration/[token]/resend/route";
import { signUploadToken } from "@/lib/upload-token";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { eventPhotoKey, eventIdDocumentKey, uploadFile } from "@/lib/storage";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

async function setup({ expired = false } = {}) {
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "",
      smtpPort: 587,
      smtpFrom: "n@x",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
    },
  });
  const org = await prisma.organization.create({
    data: { name: "O", slug: `o-${Date.now()}` },
  });
  const ev = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "E",
      slug: `e-${Date.now()}`,
      location: "",
      date: new Date("2026-06-01"),
      registrationOpen: true,
    },
  });
  const cat = await prisma.category.create({
    data: { eventId: ev.id, name: "C", color: "#fff", number: 7 },
  });
  const editToken = "tok-" + Math.random().toString(36).slice(2);
  const reg = await prisma.registration.create({
    data: {
      id: "222222222222",
      eventId: ev.id,
      categoryId: cat.id,
      email: "old@x",
      firstName: "Old",
      lastName: "Name",
      structure: "Old",
      idDocumentType: "CNI",
      idDocumentNumber: "OLD1",
      status: "REJECTED",
      rejectionReason: "DocumentInvalide",
      rejectionDetails: "Pieces illisibles",
      editToken,
      editTokenExpiresAt: expired
        ? new Date(Date.now() - 1000)
        : new Date(Date.now() + 48 * 3600 * 1000),
    },
  });
  return { org, ev, cat, reg, editToken };
}

beforeEach(resetRateLimitForTests);

afterEach(async () => {
  await fs.rm(path.join(process.cwd(), "uploads", "events"), {
    recursive: true,
    force: true,
  });
});

describe("GET /api/public/edit-registration/[token]", () => {
  it("returns the registration + categories", async () => {
    const f = await setup();
    const res = await GET(new Request("http://t") as unknown as Request, {
      params: Promise.resolve({ token: f.editToken }),
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.registration.email).toBe("old@x");
    expect(j.registration.rejectionReason).toBe("DocumentInvalide");
    expect(j.categories).toHaveLength(1);
    expect("smtpPassword" in j.settings).toBe(false);
  });

  it("returns 410 GONE for expired token", async () => {
    const f = await setup({ expired: true });
    const res = await GET(new Request("http://t") as unknown as Request, {
      params: Promise.resolve({ token: f.editToken }),
    });
    expect(res.status).toBe(410);
  });

  it("returns 404 for unknown token", async () => {
    const res = await GET(new Request("http://t") as unknown as Request, {
      params: Promise.resolve({ token: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/public/edit-registration/[token]", () => {
  it("resubmits: snapshot, update, status PENDING, editToken cleared, activity log", async () => {
    const f = await setup();
    const photoKey = eventPhotoKey(f.ev.id, "newp.jpg");
    const docKey = eventIdDocumentKey(f.ev.id, "newd.pdf");
    await uploadFile(photoKey, Buffer.from("p"), "image/jpeg");
    await uploadFile(docKey, Buffer.from("d"), "application/pdf");
    const photoToken = signUploadToken({
      eventId: f.ev.id,
      kind: "photo",
      storageKey: photoKey,
    });
    const documentToken = signUploadToken({
      eventId: f.ev.id,
      kind: "document",
      storageKey: docKey,
    });

    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.1.1.1",
        },
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

    const updated = await prisma.registration.findUnique({
      where: { id: f.reg.id },
    });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.email).toBe("new@x.co");
    expect(updated?.editToken).toBeNull();
    expect(updated?.rejectionReason).toBeNull();

    const snap = await prisma.submissionSnapshot.findFirst({
      where: { registrationId: f.reg.id },
    });
    expect(snap?.email).toBe("old@x");

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_RESUBMITTED" },
    });
    expect(log?.targetId).toBe(f.reg.id);
  });

  it("returns 410 for expired token", async () => {
    const f = await setup({ expired: true });
    const res = await POST(
      new Request("http://t", {
        method: "POST",
        body: JSON.stringify({}),
      }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    expect(res.status).toBe(410);
  });

  it("keeps existing photo/document if no new token provided", async () => {
    const f = await setup();
    await prisma.registration.update({
      where: { id: f.reg.id },
      data: {
        photo: "events/x/photos/old.jpg",
        idDocument: "events/x/idDocuments/old.pdf",
      },
    });
    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.1.1.1",
        },
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
    const u = await prisma.registration.findUnique({
      where: { id: f.reg.id },
    });
    expect(u?.photo).toBe("events/x/photos/old.jpg");
  });
});

describe("POST /api/public/edit-registration/[token]/resend", () => {
  beforeEach(() => {
    resetEditResendCooldownForTests();
  });

  it("regenerates the editToken and logs EDIT_LINK_SENT", async () => {
    const f = await setup({ expired: true });
    const before = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    const res = await RESEND(
      new Request("http://t", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.10" },
      }) as unknown as Request,
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
      new Request("http://t", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.11" },
      }) as unknown as Request,
      { params: Promise.resolve({ token: f.editToken }) },
    );
    const after1 = await prisma.registration.findUnique({ where: { id: f.reg.id } });
    const res = await RESEND(
      new Request("http://t", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.11" },
      }) as unknown as Request,
      { params: Promise.resolve({ token: after1!.editToken! }) },
    );
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("COOLDOWN");
  });

  it("returns 200 even for unknown token (anti-enumeration)", async () => {
    const res = await RESEND(
      new Request("http://t", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.12" },
      }) as unknown as Request,
      { params: Promise.resolve({ token: "ghost" }) },
    );
    expect(res.status).toBe(200);
  });
});
