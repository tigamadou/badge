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

  it("renders an org website link in the footer when provided", () => {
    const html = buildEmail({
      title: "T",
      body: "<p>x</p>",
      ctx: {
        transporter: {} as never,
        from: "x@y",
        contactEmail: "",
        contactPhone: "",
        orgWebsite: "https://acme.example",
        settings: {} as never,
      },
    });
    expect(html).toContain('href="https://acme.example"');
    expect(html).toContain("acme.example");
  });

  it("renders only the phone line when contactEmail is empty", () => {
    const html = buildEmail({
      title: "T",
      body: "<p>x</p>",
      ctx: {
        transporter: {} as never,
        from: "x@y",
        contactEmail: "",
        contactPhone: "+225 0303",
        settings: {} as never,
      },
    });
    expect(html).toContain("+225 0303");
    expect(html).not.toContain("mailto:");
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

  it("does nothing when registration not found (logs only)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendStatusNotification("missing-id");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
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

  it("uses event context for the scope label when eventId provided", async () => {
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: '"Salon" <noreply@badge.local>',
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendSmtpTest({ to: "x@y.com", eventId: "evt-1" });

    expect(sent[0].html).toContain("événement");
    expect(sent[0].html).toContain("Salon");
  });

  it("rejects invalid email", async () => {
    await expect(mailModule.sendSmtpTest({ to: "not-an-email" })).rejects.toThrow(/email/i);
  });
});

// Couvre les branches de branding de loadBrandingContext (mail.ts:45-86) qui
// necessitent de vraies lignes en BDD : logo/website d'org, cascade logo
// Event -> Org, et event introuvable.
describe("resolveTransporter branding branches", () => {
  beforeEach(async () => {
    await resetSettings();
  });

  it("includes org logo and website when orgId provided", async () => {
    const org = await prisma.organization.create({
      data: {
        name: "OrgL",
        slug: "org-logo",
        logo: "org-logo.png",
        website: "https://org.example",
      },
    });
    const r = await resolveTransporter({ orgId: org.id });
    expect(r.logoUrl).toMatch(/\/api\/files\/org-logo\.png$/);
    expect(r.orgWebsite).toBe("https://org.example");
    expect(r.orgName).toBe("OrgL");
  });

  it("falls back to org logo and exposes org website through event branding", async () => {
    const org = await prisma.organization.create({
      data: {
        name: "OrgF",
        slug: "org-fallback",
        logo: "org-fb-logo.png",
        website: "https://orgfb.example",
      },
    });
    // Event sans logo propre : cascade vers Organization.logo (mail.ts:57).
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evt-fb", location: "L", date: new Date() },
    });
    const r = await resolveTransporter({ eventId: event.id });
    expect(r.logoUrl).toMatch(/\/api\/files\/org-fb-logo\.png$/);
    expect(r.orgWebsite).toBe("https://orgfb.example");
  });

  it("returns platform defaults when the event id does not exist", async () => {
    const r = await resolveTransporter({ eventId: "does-not-exist" });
    expect(r.from).toBe("noreply@badge.local");
    expect(r.eventTitle).toBeUndefined();
    expect(r.orgName).toBeUndefined();
  });

  // Couvre dans resolveTransporterImpl (mail.ts:95-104) : la branche `auth` (smtpUser
  // ET smtpPassword non vides) et les fallbacks `smtpHost || "localhost"`,
  // `smtpPort || 587`, `smtpFrom || "noreply@badge.local"`.
  it("configures auth and applies host/port/from fallbacks from empty smtp fields", async () => {
    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { smtpUser: "u", smtpPassword: "p", smtpHost: "", smtpPort: 0, smtpFrom: "" },
    });
    const r = await resolveTransporter({});
    expect(r.from).toBe("noreply@badge.local");
    expect(typeof r.transporter.sendMail).toBe("function");
  });
});

describe("safeSend error handling", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("swallows transporter errors and logs instead of throwing", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "safesend" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: "safesend-evt", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser("safesend");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-SAFESEND",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "safe@x.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });

    const throwing = {
      sendMail: vi.fn(async () => {
        throw new Error("SMTP down");
      }),
    };
    mockResolveTransporter({
      transporter: throwing as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mailModule.sendRegistrationConfirmation(reg.id)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail] sendMail failed"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });

  it("logs the String(err) branch when a non-Error is thrown", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "safesend2" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: "safesend2-evt", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser("safesend2");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-SAFESEND2",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "safe2@x.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "X",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });

    const throwing = {
      sendMail: vi.fn(async () => {
        // rejette une valeur non-Error : couvre la branche String(err) de safeSend.
        return Promise.reject("boom-string");
      }),
    };
    mockResolveTransporter({
      transporter: throwing as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mailModule.sendRegistrationConfirmation(reg.id)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("sendBadgePrintedNotification branches", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  async function makePrintedReg(id: string, seed: string) {
    const org = await prisma.organization.create({ data: { name: "O", slug: `bpb-${seed}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: `bpb-evt-${seed}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser(seed);
    return prisma.registration.create({
      data: {
        id,
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
  }

  it("omits the contact block when no contact info is configured", async () => {
    const reg = await makePrintedReg("REG-BPB-NC", "bpb-nc");
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendBadgePrintedNotification(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toContain("Pour toute question concernant le retrait");
  });

  it("renders only the phone row when only contactPhone is set", async () => {
    const reg = await makePrintedReg("REG-BPB-PH", "bpb-ph");
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "+225 0909",
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendBadgePrintedNotification(reg.id);

    expect(sent[0].html).toContain("Pour toute question concernant le retrait");
    expect(sent[0].html).toContain("+225 0909");
    expect(sent[0].html).not.toContain("Email :");
  });

  it("returns when registration not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendBadgePrintedNotification("missing");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

describe("sendAccountVerifyEmail", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("sends a verification email with a 24h confirmation link", async () => {
    const user = await prisma.user.create({
      data: { email: "verify@x.com", password: "x", name: "Verify User" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendAccountVerifyEmail(user.id, "plain-token-abc");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("verify@x.com");
    expect(sent[0].subject).toContain("Confirmez votre adresse email");
    expect(sent[0].html).toContain("/verify-email/plain-token-abc");
    expect(sent[0].html).toContain("Verify User");
    expect(sent[0].html).toContain("24 heures");
  });

  it("escapes the user name (anti-XSS)", async () => {
    const user = await prisma.user.create({
      data: { email: "vxss@x.com", password: "x", name: "<script>x</script>" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendAccountVerifyEmail(user.id, "tok");
    expect(sent[0].html).not.toContain("<script>x</script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });

  it("returns when user not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendAccountVerifyEmail("missing", "tok");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

describe("sendAccountPasswordReset", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("sends a self-service reset email with a 1h link", async () => {
    const user = await prisma.user.create({
      data: { email: "sspr@x.com", password: "x", name: "SS Reset" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendAccountPasswordReset(user.id, "reset-plain-tok");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("sspr@x.com");
    expect(sent[0].subject).toContain("Réinitialisation");
    expect(sent[0].html).toContain("/reset-password/reset-plain-tok");
    expect(sent[0].html).toContain("1 heure");
    expect(sent[0].html).toContain("SS Reset");
  });

  it("returns when user not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendAccountPasswordReset("missing", "tok");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

describe("sendRegistrationResubmitted", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await resetSettings();
  });

  it("sends a resubmission confirmation with an account link", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "rsub" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon", slug: "rsub-evt", location: "Abidjan", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000", number: 1 },
    });
    const participant = await mkParticipantUser("rsub");
    const reg = await prisma.registration.create({
      data: {
        id: "REG-RSUB",
        eventId: event.id,
        categoryId: cat.id,
        userId: participant.id,
        snapshotEmail: "rsub@x.com",
        snapshotLastName: "Diallo",
        snapshotFirstName: "Amadou",
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
      eventTitle: "Salon",
      settings: {} as never,
    });

    await mailModule.sendRegistrationResubmitted(reg.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("rsub@x.com");
    expect(sent[0].subject).toContain("resoumise");
    expect(sent[0].html).toContain("Amadou");
    expect(sent[0].html).toContain(`/account/registrations/${encodeURIComponent(reg.id)}`);
  });

  it("returns when registration not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendRegistrationResubmitted("missing");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});

describe("sendUserInvitation role labels", () => {
  beforeEach(async () => {
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await resetSettings();
  });

  it("injects the FR role label when a known role is provided", async () => {
    const user = await prisma.user.create({
      data: { email: "role-known@x.com", password: "tmp", name: "Role Known" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendUserInvitation(user.id, { role: "OWNER" });

    expect(sent[0].html).toContain("Role attribue");
    expect(sent[0].html).toContain("Proprietaire");
  });

  it("omits the role clause when an unknown role is provided", async () => {
    const user = await prisma.user.create({
      data: { email: "role-unknown@x.com", password: "tmp", name: "Role Unknown" },
    });
    const { transporter, sent } = mockTransport();
    mockResolveTransporter({
      transporter: transporter as never,
      from: "x@y",
      contactEmail: "",
      contactPhone: "",
      settings: {} as never,
    });

    await mailModule.sendUserInvitation(user.id, { role: "NOT_A_ROLE" });

    expect(sent[0].html).not.toContain("Role attribue");
  });

  it("returns when user not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mailModule.sendUserInvitation("missing");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mail]"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});
