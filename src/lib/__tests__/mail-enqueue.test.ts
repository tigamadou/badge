import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import * as mailModule from "@/lib/mail";
import { enqueueEmail, EMAIL_KIND } from "@/lib/jobs/enqueue-email";

// Observe l'appel sans envoyer : la file réelle est testée dans enqueue-email.test.ts.
vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => {}),
}));

function useFakeTransport() {
  const sendMail = vi.fn(async () => ({ messageId: "t" }));
  __mailTesting.setResolveTransporter(
    async () =>
      ({
        transporter: { sendMail },
        from: "x@y",
        contactEmail: "",
        contactPhone: "",
        settings: {},
      }) as unknown as ResolvedTransport,
  );
  return sendMail;
}

async function resetBase() {
  await prisma.profileSubmission.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

async function mkUser(suffix: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
  return prisma.user.create({
    data: {
      email: `mail-q-${stamp}@x.test`,
      password: "x",
      name: "Awa Diallo",
      firstName: "Awa",
      lastName: "Diallo",
      emailVerifiedAt: new Date(),
    },
  });
}

async function mkRegistration(
  id: string,
  extra: { status?: "PENDING" | "APPROVED" | "REJECTED"; badgePrinted?: boolean } = {},
) {
  const org = await prisma.organization.create({ data: { name: "Acme", slug: `q-${id}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Salon", slug: `q-evt-${id}`, location: "Abidjan", date: new Date("2026-10-01") },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "Visiteur", color: "#000000", number: 1 },
  });
  const user = await mkUser(id);
  const reg = await prisma.registration.create({
    data: {
      id,
      eventId: event.id,
      categoryId: cat.id,
      userId: user.id,
      snapshotEmail: `reg-${id.toLowerCase()}@x.test`,
      snapshotLastName: "Diallo",
      snapshotFirstName: "Amadou",
      snapshotStructure: "ENSEA",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "ABC123",
      snapshotIdDocument: "uploads/test/doc.pdf",
      ...extra,
    },
  });
  return { reg, event };
}

beforeEach(async () => {
  vi.mocked(enqueueEmail).mockClear();
  useFakeTransport();
  await resetBase();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  __mailTesting.reset();
  vi.restoreAllMocks();
});

type Case = {
  fn: string;
  kind: string;
  priority: "high" | "normal";
  run: () => Promise<{ to: string; ctx: unknown }>;
};

const cases: Case[] = [
  {
    fn: "sendRegistrationConfirmation",
    kind: EMAIL_KIND.REGISTRATION_RECEIVED,
    priority: "normal",
    run: async () => {
      const { reg, event } = await mkRegistration("REG-Q1");
      await mailModule.sendRegistrationConfirmation(reg.id);
      return { to: reg.snapshotEmail, ctx: { eventId: event.id } };
    },
  },
  {
    fn: "sendStatusNotification (APPROVED)",
    kind: EMAIL_KIND.REGISTRATION_APPROVED,
    priority: "normal",
    run: async () => {
      const { reg, event } = await mkRegistration("REG-Q2", { status: "APPROVED" });
      await mailModule.sendStatusNotification(reg.id);
      return { to: reg.snapshotEmail, ctx: { eventId: event.id } };
    },
  },
  {
    fn: "sendStatusNotification (REJECTED)",
    kind: EMAIL_KIND.REGISTRATION_REJECTED,
    priority: "normal",
    run: async () => {
      const { reg, event } = await mkRegistration("REG-Q3", { status: "REJECTED" });
      await mailModule.sendStatusNotification(reg.id);
      return { to: reg.snapshotEmail, ctx: { eventId: event.id } };
    },
  },
  {
    fn: "sendBadgePrintedNotification",
    kind: EMAIL_KIND.BADGE_PRINTED,
    priority: "normal",
    run: async () => {
      const { reg, event } = await mkRegistration("REG-Q4", { badgePrinted: true });
      await mailModule.sendBadgePrintedNotification(reg.id);
      return { to: reg.snapshotEmail, ctx: { eventId: event.id } };
    },
  },
  {
    fn: "sendAccountVerifyEmail",
    kind: EMAIL_KIND.ACCOUNT_VERIFY_EMAIL,
    priority: "high",
    run: async () => {
      const user = await mkUser("verify");
      await mailModule.sendAccountVerifyEmail(user.id, "tok");
      return { to: user.email, ctx: {} };
    },
  },
  {
    fn: "sendAccountPasswordReset",
    kind: EMAIL_KIND.ACCOUNT_PASSWORD_RESET,
    priority: "high",
    run: async () => {
      const user = await mkUser("reset");
      await mailModule.sendAccountPasswordReset(user.id, "tok");
      return { to: user.email, ctx: {} };
    },
  },
  {
    fn: "sendRegistrationResubmitted",
    kind: EMAIL_KIND.REGISTRATION_RESUBMITTED,
    priority: "normal",
    run: async () => {
      const { reg, event } = await mkRegistration("REG-Q5");
      await mailModule.sendRegistrationResubmitted(reg.id);
      return { to: reg.snapshotEmail, ctx: { eventId: event.id } };
    },
  },
  {
    fn: "sendUserInvitation",
    kind: EMAIL_KIND.USER_INVITATION,
    priority: "high",
    run: async () => {
      const org = await prisma.organization.create({ data: { name: "Inv", slug: "q-inv" } });
      const user = await mkUser("invite");
      await mailModule.sendUserInvitation(user.id, { orgId: org.id });
      return { to: user.email, ctx: { orgId: org.id, eventId: undefined } };
    },
  },
  {
    fn: "sendPasswordResetEmail",
    kind: EMAIL_KIND.USER_PASSWORD_RESET,
    priority: "high",
    run: async () => {
      const user = await mkUser("pwreset");
      await mailModule.sendPasswordResetEmail(user.id);
      return { to: user.email, ctx: {} };
    },
  },
  {
    fn: "sendProfileApproved",
    kind: EMAIL_KIND.PROFILE_APPROVED,
    priority: "normal",
    run: async () => {
      const user = await mkUser("profok");
      await mailModule.sendProfileApproved(user.id);
      return { to: user.email, ctx: {} };
    },
  },
  {
    fn: "sendProfileRejected",
    kind: EMAIL_KIND.PROFILE_REJECTED,
    priority: "normal",
    run: async () => {
      const user = await mkUser("profko");
      await mailModule.sendProfileRejected(user.id);
      return { to: user.email, ctx: {} };
    },
  },
];

describe("send* mettent en file via enqueueEmail", () => {
  it.each(cases)("$fn met en file le kind $kind", async ({ kind, priority, run }) => {
    const expected = await run();
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const args = vi.mocked(enqueueEmail).mock.calls[0];
    expect(args[0]).toEqual(
      expect.objectContaining({ to: expected.to, kind, ctx: expected.ctx }),
    );
    expect(args[1]).toBeUndefined();
    expect(args[0].priority ?? "normal").toBe(priority);
    expect(args[0].html).toContain('<html lang="fr"');
  });

  it("n'appelle pas enqueueEmail quand l'inscription est introuvable", async () => {
    await mailModule.sendRegistrationConfirmation("REG-INCONNUE");
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("n'appelle pas enqueueEmail quand le statut n'est pas éligible", async () => {
    const { reg } = await mkRegistration("REG-Q6", { status: "PENDING" });
    await mailModule.sendStatusNotification(reg.id);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("n'appelle pas enqueueEmail quand le badge n'est pas imprimé", async () => {
    const { reg } = await mkRegistration("REG-Q7", { badgePrinted: false });
    await mailModule.sendBadgePrintedNotification(reg.id);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("sendSmtpTest n'utilise pas enqueueEmail", async () => {
    const sendMail = useFakeTransport();
    await mailModule.sendSmtpTest({ to: "dest@x.test" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
