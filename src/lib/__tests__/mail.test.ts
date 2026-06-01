import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resolveTransporter,
  buildEmail,
  __mailTesting,
  type ResolvedTransport,
} from "@/lib/mail";
import * as mailModule from "@/lib/mail";

type SentMail = { from: string; to: string; subject: string; html: string };

function mockTransport(sent: SentMail[] = []) {
  const transporter = {
    sendMail: vi.fn(async (opts: { from: string; to: string; subject: string; html: string }) => {
      sent.push({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html });
      return { messageId: "test-" + sent.length };
    }),
  };
  return { transporter, sent };
}

// Helper d'injection : remplace l'implementation de resolveTransporter utilisee
// par les fonctions d'envoi (sendRegistrationConfirmation, etc.). Le binding ESM
// interne empeche vi.spyOn d'intercepter les appels intra-module — on passe par
// l'API __mailTesting.
function mockResolveTransporter(transport: ResolvedTransport): void {
  __mailTesting.setResolveTransporter(async () => transport);
}

afterEach(() => {
  __mailTesting.reset();
});

async function resetSettings() {
  await prisma.eventSettings.deleteMany();
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

// v2-11 : helper pour creer un User participant minimal (Registration.userId est FK obligatoire).
async function mkParticipantUser(suffix: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
  return prisma.user.create({
    data: {
      email: `mail-p-${stamp}@x.test`,
      password: "x",
      name: "P",
      emailVerifiedAt: new Date(),
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
    const org = await prisma.organization.create({
      data: {
        name: "Org Acme",
        slug: "acme",
        contactEmail: "c@acme.com",
        contactPhone: "+225 0101",
      },
    });
    const r = await resolveTransporter({ orgId: org.id });
    expect(r.from).toBe('"Org Acme" <noreply@badge.local>');
    expect(r.contactEmail).toBe("c@acme.com");
    expect(r.contactPhone).toBe("+225 0101");
    expect(r.orgName).toBe("Org Acme");
  });

  it("labels platform from with event title when eventId provided", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Acme", slug: "acme2" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon 2026",
        slug: "salon-2026",
        location: "Abidjan",
        date: new Date(),
      },
    });
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "salon@acme.com", contactPhone: "+225 0202" },
    });
    const r = await resolveTransporter({ eventId: event.id });
    expect(r.from).toBe('"Salon 2026" <noreply@badge.local>');
    expect(r.eventTitle).toBe("Salon 2026");
    expect(r.orgName).toBe("Org Acme");
  });

  it("labels with event title even when event has no settings", async () => {
    const org = await prisma.organization.create({ data: { name: "Org X", slug: "x1" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Evt X", slug: "evt-x1", location: "L", date: new Date() },
    });
    const r = await resolveTransporter({ eventId: event.id });
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

describe("buildEmail", () => {
  it("renders title and body with logo and footer", () => {
    const html = buildEmail({
      title: "Bienvenue",
      body: "<p>Bonjour <strong>Amadou</strong></p>",
      ctx: {
        transporter: {} as never,
        from: "x@y",
        contactEmail: "c@x.com",
        contactPhone: "+225 0101",
        eventTitle: "Salon 2026",
        orgName: "Acme",
        logoUrl: "https://x/api/files/logo.png",
        settings: {} as never,
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
        transporter: {} as never,
        from: "x@y",
        contactEmail: "",
        contactPhone: "",
        settings: {} as never,
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
        transporter: {} as never,
        from: "x@y",
        contactEmail: "c@x",
        contactPhone: "",
        orgName: "Acme",
        settings: {} as never,
      },
    });
    expect(html).toContain("Acme");
  });

  it("includes lang=fr and utf-8 meta", () => {
    const html = buildEmail({
      title: "T",
      body: "<p>x</p>",
      ctx: {
        transporter: {} as never,
        from: "",
        contactEmail: "",
        contactPhone: "",
        settings: {} as never,
      },
    });
    expect(html).toMatch(/lang="fr"/);
    expect(html).toMatch(/charset="utf-8"/i);
  });
});

describe("sendRegistrationConfirmation", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("sends a confirmation email with event branding", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "rcacme" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon 2026",
        slug: "rc-salon",
        location: "Abidjan",
        date: new Date("2026-10-01"),
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "Visiteur", color: "#000000", number: 1 },
    });
    const participant = await mkParticipantUser("conf-1");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-001",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "amadou@example.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
        snapshotStructure: "ENSEA",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "ABC123",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });

    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: '"Salon 2026" <noreply@badge.local>',
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon 2026",
      orgName: "Acme",
      settings: {} as never,
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
    const participant = await mkParticipantUser("xss");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-XSS",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "x@x",
        snapshotLastName: "<script>alert(1)</script>",
        snapshotFirstName: "Pwn",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });

    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
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

describe("sendStatusNotification", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  async function makeReg(status: "APPROVED" | "REJECTED", extra: Record<string, unknown> = {}) {
    const seed = `${status}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const org = await prisma.organization.create({
      data: { name: "O", slug: `sn-${seed}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon",
        slug: `sn-evt-${seed}`,
        location: "Abidjan",
        date: new Date("2026-10-01"),
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser(seed);
    return prisma.registration.create({
      data: {
        id: `REG-${seed}`,
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "x@example.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status,
        ...extra,
      },
    });
  }

  it("sends approval email when status is APPROVED", async () => {
    const reg = await makeReg("APPROVED");
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("approuvée");
    expect(sent[0].html).toContain("approuvée");
  });

  // v2-11 : plus de editToken. Le lien pointe vers /account/registrations/[id]
  // (login requis cote participant).
  it("sends rejection email with reason and account link", async () => {
    const reg = await makeReg("REJECTED", {
      rejectionReason: "Photo illisible",
      rejectionDetails: "Veuillez fournir une photo nette",
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("rejetée");
    expect(sent[0].html).toContain("Photo illisible");
    expect(sent[0].html).toContain("Veuillez fournir une photo nette");
    expect(sent[0].html).toContain(`/account/registrations/${encodeURIComponent(reg.id)}`);
  });

  it("does nothing when status is PENDING", async () => {
    const reg = await makeReg("REJECTED");
    await prisma.registration.update({ where: { id: reg.id }, data: { status: "PENDING" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendStatusNotification(reg.id);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });

  it("escapes rejection details (anti-XSS)", async () => {
    const reg = await makeReg("REJECTED", {
      rejectionReason: "<img src=x onerror=alert(1)>",
      rejectionDetails: "<b>bold</b>",
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendStatusNotification(reg.id);

    expect(sent[0].html).not.toContain("<img src=x");
    expect(sent[0].html).toContain("&lt;img");
    expect(sent[0].html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });
});

describe("sendBadgePrintedNotification", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("sends badge printed email with contact footer", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "bpacme" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon",
        slug: "bp-salon",
        location: "Abidjan",
        date: new Date(),
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser("bp");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-BP",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "x@x.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
        badgePrinted: true,
        badgePrintedAt: new Date(),
      },
    });

    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "c@org.com",
      contactPhone: "+225 0101",
      eventTitle: "Salon",
      settings: {} as never,
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
    const participant = await mkParticipantUser("bp-no");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-BP-NO",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "x@x",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
        badgePrinted: false,
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendBadgePrintedNotification(reg.id);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

// v2-11 : sendEditLinkEmail supprime (plus de editToken public). La resoumission
// passe par /account/registrations/[id]/resubmit cote participant connecte.

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
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
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
    mockResolveTransporter({
      transporter: transporter as never,
      from: '"Acme" <x@y>',
      contactEmail: "",
      contactPhone: "",
      orgName: "Acme",
      settings: {} as never,
    });

    await mailModule.sendUserInvitation(user.id, { orgId: org.id });

    expect(sent[0].html).toContain("Acme");
  });

  it("escapes the user name", async () => {
    const user = await prisma.user.create({
      data: { email: "xss@x.com", password: "tmp", name: "<script>x</script>" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });
    await mailModule.sendUserInvitation(user.id);
    expect(sent[0].html).not.toContain("<script>x</script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(async () => {
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("generates a 24h token and sends a reset link", async () => {
    const user = await prisma.user.create({
      data: { email: "reset@x.com", password: "old", name: "Reset User" },
    });

    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
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
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

describe("sendSmtpTest", () => {
  beforeEach(async () => {
    await prisma.organization.deleteMany();
    await resetSettings();
  });

  it("sends test email with platform context", async () => {
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "noreply@badge.local",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendSmtpTest({ to: "tester@x.com" });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("tester@x.com");
    expect(sent[0].subject).toBe("Test SMTP — Badge");
    expect(sent[0].html).toContain("test");
  });

  it("uses org context for branding when orgId provided (SMTP stays platform)", async () => {
    const org = await prisma.organization.create({
      data: { name: "OrgT", slug: "test-smtp-org" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: '"OrgT" <noreply@badge.local>',
      contactEmail: "",
      contactPhone: "",
      orgName: "OrgT",
      settings: {} as never,
    });

    await mailModule.sendSmtpTest({ to: "x@y.com", orgId: org.id });

    expect(sent[0].from).toBe('"OrgT" <noreply@badge.local>');
    expect(sent[0].html).toContain("OrgT");
  });

  it("rejects invalid email", async () => {
    await expect(mailModule.sendSmtpTest({ to: "not-an-email" })).rejects.toThrow(/email/i);
  });
});
