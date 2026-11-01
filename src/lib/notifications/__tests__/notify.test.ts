import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import { notify, notifyAll, withNotificationGuard, EMAIL_BY_TYPE } from "../notify";
import { registrationCreatedMessage, registrationApprovedMessage } from "../messages";
import type { NotifyInput } from "../types";
import { addOrgMember, makeEvent, makeOrg, makeUser } from "./helpers";

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.mocked(enqueueEmail).mockReset();
  vi.mocked(enqueueEmail).mockResolvedValue(undefined);
  __mailTesting.setResolveTransporter(
    async () =>
      ({
        transporter: { sendMail: vi.fn() },
        from: "x@y",
        contactEmail: "",
        contactPhone: "",
        settings: {},
      }) as unknown as ResolvedTransport,
  );
});
afterEach(() => {
  __mailTesting.reset();
  vi.restoreAllMocks();
});

async function seed() {
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  const a = await makeUser();
  const b = await makeUser();
  return { org, event, a, b };
}

function input(over: Partial<NotifyInput> & Pick<NotifyInput, "recipients">): NotifyInput {
  return {
    type: "REGISTRATION_CREATED",
    scope: "EVENT",
    content: registrationCreatedMessage({
      eventId: "e1", eventTitle: "Forum", registrationId: "r1", participantName: "Awa <b>", categoryName: "Presse",
    }),
    ...over,
  };
}

describe("notify", () => {
  it("crée une ligne par destinataire avec type, portée, orgId, eventId, href et links", async () => {
    const { org, event, a, b } = await seed();
    await notify(input({ recipients: { users: [a.id, b.id] }, orgId: org.id, eventId: event.id }));
    const rows = await prisma.notification.findMany({ orderBy: { userId: "asc" } });
    expect(rows).toHaveLength(2);
    const row = rows[0];
    expect(row).toMatchObject({
      type: "REGISTRATION_CREATED", scope: "EVENT", orgId: org.id, eventId: event.id,
      title: "Nouvelle inscription", href: "/event/e1/registrations/r1", readAt: null,
    });
    expect(row.links).toEqual([
      { label: "Voir l'inscription", href: "/event/e1/registrations/r1" },
      { label: "Voir l'évènement", href: "/event/e1" },
    ]);
  });

  it("déduit orgId de l'évènement quand il manque", async () => {
    const { org, event, a } = await seed();
    await notify(input({ recipients: { users: [a.id] }, eventId: event.id }));
    const row = await prisma.notification.findFirstOrThrow();
    expect(row.orgId).toBe(org.id);
  });

  it("envoie un email par destinataire quand EMAIL_BY_TYPE le prévoit", async () => {
    const { org, event, a, b } = await seed();
    process.env.BASE_URL = "https://badge.example";
    try {
      await notify(input({ recipients: { users: [a.id, b.id] }, orgId: org.id, eventId: event.id }));
    } finally {
      delete process.env.BASE_URL;
    }
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    const msg = vi.mocked(enqueueEmail).mock.calls[0][0];
    expect([a.email, b.email]).toContain(msg.to);
    expect(msg.subject).toBe("Nouvelle inscription");
    expect(msg.kind).toBe("notification.registration_created");
    expect(msg.priority).toBe("normal");
    expect(msg.ctx).toEqual({ eventId: event.id, orgId: org.id });
    expect(msg.html).toContain("https://badge.example/event/e1/registrations/r1");
    expect(msg.html).toContain("Voir l&#39;inscription");
    expect(msg.html).toContain("Awa &lt;b&gt;");
    expect(msg.html).not.toContain("Awa <b>");
  });

  it("utilise l'URL de base par défaut et une seule résolution de transport par entrée", async () => {
    const { a, b } = await seed();
    const resolve = vi.fn(
      async () =>
        ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
    );
    __mailTesting.setResolveTransporter(resolve);
    await notify(input({ recipients: { users: [a.id, b.id] } }));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueEmail).mock.calls[0][0].html).toContain("/event/e1/registrations/r1");
  });

  it("n'envoie pas d'email pour REGISTRATION_APPROVED, ni si email: false", async () => {
    const { a } = await seed();
    await notify({
      type: "REGISTRATION_APPROVED",
      scope: "PARTICIPANT",
      recipients: { users: [a.id] },
      content: registrationApprovedMessage({ eventTitle: "F", registrationId: "r1" }),
    });
    await notify(input({ recipients: { users: [a.id] }, email: false }));
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(await prisma.notification.count()).toBe(2);
  });

  it("email: true force l'envoi d'un type sans email par défaut", async () => {
    const { a } = await seed();
    await notify({
      type: "REGISTRATION_APPROVED",
      scope: "PARTICIPANT",
      recipients: { users: [a.id] },
      content: registrationApprovedMessage({ eventTitle: "F", registrationId: "r1" }),
      email: true,
    });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("EMAIL_BY_TYPE suit la matrice", () => {
    expect(EMAIL_BY_TYPE.REGISTRATION_CREATED).toBe(true);
    expect(EMAIL_BY_TYPE.QUOTA_EXCEEDED).toBe(true);
    expect(EMAIL_BY_TYPE.EMAIL_FAILED).toBe(false);
    expect(EMAIL_BY_TYPE.BADGE_PRINTED).toBe(false);
    expect(EMAIL_BY_TYPE.PROFILE_REJECTED).toBe(false);
    expect(EMAIL_BY_TYPE.PRINT_REQUEST_SUBMITTED).toBe(true);
    expect(EMAIL_BY_TYPE.PRINT_REQUEST_QUOTED).toBe(true);
    expect(EMAIL_BY_TYPE.PRINT_REQUEST_MESSAGE).toBe(true);
    expect(EMAIL_BY_TYPE.PRINT_REQUEST_STATUS_CHANGED).toBe(true);
  });

  it("aucun destinataire : ni ligne ni email", async () => {
    const { a } = await seed();
    await notify(input({ recipients: { users: [a.id] }, actorId: a.id }));
    expect(await prisma.notification.count()).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("une erreur d'enqueueEmail est loggée et n'empêche pas les notifications", async () => {
    const { a } = await seed();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(enqueueEmail).mockRejectedValue(new Error("boom"));
    await expect(notify(input({ recipients: { users: [a.id] } }))).resolves.toBeUndefined();
    expect(await prisma.notification.count()).toBe(1);
    expect(err).toHaveBeenCalledWith("[notify] failed", expect.objectContaining({ type: "REGISTRATION_CREATED" }));
  });

  it("notifyAll ne notifie qu'une fois un utilisateur présent dans deux audiences", async () => {
    const { org, a } = await seed();
    const staff = await makeUser({ staffRole: "STAFF_ADMIN" });
    await addOrgMember(staff.id, org.id, "OWNER");
    await notifyAll([
      input({ type: "SUBSCRIPTION_CHANGED", scope: "ORG", recipients: { orgRoles: { orgId: org.id, roles: ["OWNER"] } }, orgId: org.id }),
      input({ type: "SUBSCRIPTION_CHANGED", scope: "PLATFORM", recipients: { staffMinRole: "STAFF_ADMIN" } }),
    ]);
    void a;
    const rows = await prisma.notification.findMany({ where: { userId: staff.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].scope).toBe("ORG");
  });

  it("écrit dans la transaction fournie", async () => {
    const { a } = await seed();
    await expect(
      prisma.$transaction(async (tx) => {
        await notify(input({ recipients: { users: [a.id] } }), tx);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await prisma.notification.count()).toBe(0);
    expect(enqueueEmail).toHaveBeenCalledWith(expect.anything(), expect.anything());
  });

  it("withNotificationGuard avale et logge l'erreur", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(withNotificationGuard("x", async () => { throw new Error("nope"); })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith("[notify] trigger failed", expect.objectContaining({ label: "x" }));
    await expect(withNotificationGuard("ok", async () => undefined)).resolves.toBeUndefined();
  });
});
