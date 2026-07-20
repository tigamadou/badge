import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Spy sur renderToStream : delegue a l'implementation reelle par defaut (tous les tests
// existants font un rendu PDF veritable), sauf le test qui force une erreur de stream pour
// exercer la branche `stream.on("error", ...)` (l.109) -- non atteignable via un rendu reel.
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToStream: vi.fn(actual.renderToStream) };
});
import { renderToStream } from "@react-pdf/renderer";

// Compte les Page objects dans un buffer PDF (cf. render.test.tsx).
function countPdfPages(buf: Buffer): number {
  const txt = buf.toString("latin1");
  const matches = txt.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

async function bodyToBuffer(res: Response): Promise<Buffer> {
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function setupFixtures(
  role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" = "ADMIN",
  opts: { orgOwner?: boolean } = {},
) {
  // Par defaut le user est OWNER de l'org (herite du role event ADMIN). Pour tester un
  // role event PUR (ex. VIEWER rejete faute de badge.print), passer { orgOwner: false }
  // afin que le role effectif ne soit pas remonte au niveau ADMIN par l'appartenance org.
  const { orgOwner = true } = opts;
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { badgeTemplateId: "default-v1" },
    create: {
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
      badgeTemplateId: "default-v1",
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: `tpl-admin-${Date.now()}@v2-12.test`,
      password: "x",
      name: "Tpl Admin",
      isStaff: false,
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({
    data: { name: "Tpl Org", slug: `tpl-org-${Date.now()}` },
  });
  if (orgOwner) {
    await prisma.orgMembership.create({
      data: { userId: admin.id, orgId: org.id, role: "OWNER" },
    });
  }
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Tpl Salon",
      slug: `tpl-evt-${Date.now()}`,
      location: "Abidjan",
      date: new Date("2026-10-01"),
    },
  });
  await prisma.eventMembership.create({
    data: { userId: admin.id, eventId: event.id, role },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Visiteur", color: "#4f46e5", number: 1 },
  });
  const reg = await prisma.registration.create({
    data: {
      id: `BADGE-${Date.now()}`,
      eventId: event.id,
      categoryId: category.id,
      userId: admin.id,
      snapshotFirstName: "Awa",
      snapshotLastName: "Diallo",
      snapshotEmail: admin.email,
      snapshotStructure: "ENSEA",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "X-1",
      snapshotIdDocument: "uploads/test/cni.pdf",
      status: "APPROVED",
    },
  });

  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: admin.id, email: admin.email, name: admin.name, isStaff: false },
  } as never);

  return { admin, org, event, reg };
}

describe("GET /api/org/[orgId]/events/[eventId]/badges/[badgeId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("renvoie un PDF avec content-type application/pdf", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = await bodyToBuffer(res);
    expect(buf.toString("latin1", 0, 5)).toBe("%PDF-");
  }, 30_000);

  it("rend 1 page quand template effectif = default-v1", async () => {
    const { org, event, reg } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    const buf = await bodyToBuffer(res);
    expect(countPdfPages(buf)).toBe(1);
    expect(res.headers.get("x-template-id")).toBe("default-v1");
  }, 30_000);

  it("rend 2 pages quand Event.badgeTemplateId = recto-verso-v1", async () => {
    const { org, event, reg } = await setupFixtures();
    await prisma.event.update({
      where: { id: event.id },
      data: { badgeTemplateId: "recto-verso-v1" },
    });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    const buf = await bodyToBuffer(res);
    expect(countPdfPages(buf)).toBe(2);
    expect(res.headers.get("x-template-id")).toBe("recto-verso-v1");
  }, 30_000);

  it("fallback default-v1 quand badgeTemplateId orphelin", async () => {
    const { org, event, reg } = await setupFixtures();
    await prisma.event.update({
      where: { id: event.id },
      data: { badgeTemplateId: "id-inexistant-xyz" },
    });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.headers.get("x-template-id")).toBe("default-v1");
  }, 30_000);

  it("retourne 403 EVENT_FORBIDDEN pour un VIEWER (pas de permission badge.print)", async () => {
    // VIEWER pur (sans OrgMembership OWNER) : n'a pas badge.print -> 403.
    const { org, event, reg } = await setupFixtures("VIEWER", { orgOwner: false });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    // Garde par permission badge.print via withEventAuth : code standard des
    // routes event (remplace le "FORBIDDEN" ad-hoc de l'ancien double-verrou).
    expect(json.error).toBe("EVENT_FORBIDDEN");
  });

  it("retourne 404 NOT_FOUND pour un badgeId inexistant", async () => {
    const { org, event } = await setupFixtures();
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/ghost-xyz`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: "ghost-xyz" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("NOT_FOUND");
  });

  it("fallback DEFAULT_TEMPLATE_ID quand PlatformSettings (singleton) est absent", async () => {
    const { org, event, reg } = await setupFixtures();
    await prisma.platformSettings.delete({ where: { id: "singleton" } });
    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-template-id")).toBe("default-v1");
  }, 30_000);

  it("propage une erreur de stream au reader de la reponse (controller.error)", async () => {
    const { org, event, reg } = await setupFixtures();
    const { EventEmitter } = await import("node:events");
    const fakeStream = new EventEmitter();
    vi.mocked(renderToStream).mockResolvedValueOnce(fakeStream as unknown as NodeJS.ReadableStream);

    const { GET } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/badges/${reg.id}`);
    const res = await GET(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, badgeId: reg.id }),
    });
    expect(res.status).toBe(200);

    fakeStream.emit("error", new Error("boom-render"));
    await expect(res.arrayBuffer()).rejects.toThrow();
  });
});
