import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import { notifyEmailFailed } from "../triggers";
import { makeUser } from "./helpers";

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.mocked(enqueueEmail).mockClear();
  __mailTesting.setResolveTransporter(
    async () =>
      ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
  );
});
afterEach(() => __mailTesting.reset());

describe("notifyEmailFailed", () => {
  it("notifie STAFF_ADMIN et au-dessus, sans email", async () => {
    const admin = await makeUser({ staffRole: "STAFF_ADMIN" });
    const sa = await makeUser({ staffRole: "SUPER_ADMIN" });
    await makeUser({ staffRole: "STAFF_SUPPORT" });
    await notifyEmailFailed({ id: "job1", kind: "registration.approved", recipient: "a@b.c", attempts: 5 });
    const rows = await prisma.notification.findMany({ where: { type: "EMAIL_FAILED" } });
    expect(rows.map((r) => r.userId).sort()).toEqual([admin.id, sa.id].sort());
    expect(rows[0]).toMatchObject({ scope: "PLATFORM", href: "/platform/jobs/job1", title: "Email en échec" });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
