import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { POST as UPLOAD } from "@/app/api/upload/route";
import { POST as REGISTER } from "@/app/api/public/events/[slug]/registrations/route";
import { GET as VERIFY } from "@/app/api/public/verify/[badgeId]/route";
import { POST as EDIT } from "@/app/api/public/edit-registration/[token]/route";
import {
  POST as RESEND,
  resetEditResendCooldownForTests,
} from "@/app/api/public/edit-registration/[token]/resend/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

beforeEach(async () => {
  resetRateLimitForTests();
  resetEditResendCooldownForTests();
  // Le global test-setup.ts reset deja toutes les tables dans l'ordre FK.
  // On ne reset ici que PlatformSettings et on (re)cree le singleton dont les
  // routes publiques ont besoin (reCAPTCHA desactive pour les tests).
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "",
      smtpPort: 587,
      smtpFrom: "noreply@x",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
    },
  });
});

afterEach(async () => {
  // Nettoyage filesystem : uploadFor cree 4 fichiers reels par run du premier test.
  await fs.rm(path.join(process.cwd(), "uploads", "events"), {
    recursive: true,
    force: true,
  });
});

async function uploadFor(slug: string, kind: "photo" | "document") {
  const fd = new FormData();
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // En-tete PNG-ish
  const mime = kind === "photo" ? "image/png" : "application/pdf";
  fd.append(
    "file",
    new Blob([bytes], { type: mime }),
    kind === "photo" ? "p.png" : "d.pdf",
  );
  const res = await UPLOAD(
    new Request(
      `http://t/api/upload?context=event:${slug}&kind=${kind}`,
      { method: "POST", body: fd, headers: { "x-forwarded-for": "5.5.5.5" } },
    ) as unknown as Request,
  );
  expect(res.status).toBe(200);
  const j = await res.json();
  return j.token as string;
}

describe("public e2e", () => {
  it("goes through register -> reject -> edit -> resubmit -> approve -> verify", async () => {
    const org = await prisma.organization.create({
      data: { name: "E2E", slug: "e2e-org" },
    });
    const ev = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E2E Event",
        slug: "e2e-evt",
        location: "L",
        date: new Date("2026-06-15"),
        registrationOpen: true,
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: ev.id, name: "VIP", color: "#000", number: 5 },
    });

    // 1. Upload + register
    const photoToken = await uploadFor(ev.slug, "photo");
    const docToken = await uploadFor(ev.slug, "document");
    const regRes = await REGISTER(
      new Request(
        `http://t/api/public/events/${ev.slug}/registrations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "5.5.5.5",
          },
          body: JSON.stringify({
            email: "alice@x.co",
            firstName: "Alice",
            lastName: "Doe",
            structure: "Acme",
            categoryId: cat.id,
            idDocumentType: "CNI",
            idDocumentNumber: "ABC",
            photoToken,
            idDocumentToken: docToken,
          }),
        },
      ) as unknown as Request,
      { params: Promise.resolve({ slug: ev.slug }) },
    );
    expect(regRes.status).toBe(201);
    const { id } = await regRes.json();

    // 2. Rejet (action admin simulee : update direct + pose d'un editToken)
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

    // 3. Edition / resoumission
    const newPhotoToken = await uploadFor(ev.slug, "photo");
    const newDocToken = await uploadFor(ev.slug, "document");
    const editRes = await EDIT(
      new Request("http://t", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "5.5.5.5",
        },
        body: JSON.stringify({
          email: "alice@x.co",
          firstName: "Alice",
          lastName: "Doe",
          structure: "Acme",
          categoryId: cat.id,
          idDocumentType: "CNI",
          idDocumentNumber: "ABC",
          photoToken: newPhotoToken,
          idDocumentToken: newDocToken,
        }),
      }) as unknown as Request,
      { params: Promise.resolve({ token: editToken }) },
    );
    expect(editRes.status).toBe(200);

    const afterEdit = await prisma.registration.findUnique({ where: { id } });
    expect(afterEdit?.status).toBe("PENDING");
    expect(afterEdit?.editToken).toBeNull();
    const snap = await prisma.submissionSnapshot.findFirst({
      where: { registrationId: id },
    });
    expect(snap).toBeTruthy();

    // 4. Approbation (action admin simulee) + impression badge
    await prisma.registration.update({
      where: { id },
      data: {
        status: "APPROVED",
        badgePrinted: true,
        badgePrintedAt: new Date(),
      },
    });

    // 5. Verification publique du QR code
    const verifyRes = await VERIFY(
      new Request("http://t") as unknown as Request,
      { params: Promise.resolve({ badgeId: id }) },
    );
    expect(verifyRes.status).toBe(200);
    const v = await verifyRes.json();
    expect(v.valid).toBe(true);
    expect(v.participant.firstName).toBe("Alice");
  });

  it("resend issues a fresh editToken on an expired one", async () => {
    const org = await prisma.organization.create({
      data: { name: "E2E2", slug: "e2e2" },
    });
    const ev = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E2",
        slug: "e2e2-evt",
        location: "",
        date: new Date(),
        registrationOpen: true,
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: ev.id, name: "C", color: "#fff", number: 1 },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "999999999999",
        eventId: ev.id,
        categoryId: cat.id,
        email: "x@x",
        firstName: "X",
        lastName: "X",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X1",
        status: "REJECTED",
        editToken: "old-tok",
        editTokenExpiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await RESEND(
      new Request("http://t", {
        method: "POST",
        headers: { "x-forwarded-for": "1.1.1.1" },
      }) as unknown as Request,
      { params: Promise.resolve({ token: "old-tok" }) },
    );
    expect(res.status).toBe(200);
    const fresh = await prisma.registration.findUnique({
      where: { id: reg.id },
    });
    expect(fresh?.editToken).not.toBe("old-tok");
    expect(fresh!.editTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
