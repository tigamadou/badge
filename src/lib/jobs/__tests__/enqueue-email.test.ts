import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting } from "@/lib/mail";
import { enqueueEmail, EMAIL_KIND } from "@/lib/jobs/enqueue-email";
import { fakeTransport } from "./helpers";

const msg = {
  to: "a@x.test",
  subject: "S",
  html: "<p>H</p>",
  kind: "registration.approved",
};

afterEach(() => __mailTesting.reset());

describe("enqueueEmail", () => {
  it("inserts a PENDING EMAIL job with denormalized fields", async () => {
    const transport = fakeTransport();
    transport.install();
    await enqueueEmail(msg);
    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      type: "EMAIL",
      status: "PENDING",
      kind: "registration.approved",
      recipient: "a@x.test",
      priority: 0,
      payload: { to: "a@x.test", subject: "S", html: "<p>H</p>", kind: "registration.approved" },
    });
    expect(transport.sent).toHaveLength(0);
  });

  it("maps priority high to 10", async () => {
    await enqueueEmail({ ...msg, priority: "high" });
    expect((await prisma.job.findFirstOrThrow()).priority).toBe(10);
  });

  it("stores ctx and replyTo in the payload when provided", async () => {
    await enqueueEmail({ ...msg, ctx: { eventId: "e1" }, replyTo: "r@x.test" });
    const job = await prisma.job.findFirstOrThrow();
    expect(job.payload).toMatchObject({ ctx: { eventId: "e1" }, replyTo: "r@x.test" });
  });

  it("joins the caller transaction", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await enqueueEmail(msg, tx);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await prisma.job.count()).toBe(0);
  });

  it("commits with the caller transaction", async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueEmail(msg, tx);
    });
    expect(await prisma.job.count()).toBe(1);
  });

  it("declares unique kinds", () => {
    expect(new Set(Object.values(EMAIL_KIND)).size).toBe(Object.values(EMAIL_KIND).length);
  });
});
