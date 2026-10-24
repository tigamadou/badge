import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("modèle Job", () => {
  it("applies the spec defaults on a minimal EMAIL job", async () => {
    const job = await prisma.job.create({
      data: { type: "EMAIL", kind: "test.kind", payload: { to: "a@x.test" } },
    });
    expect(job).toMatchObject({
      status: "PENDING",
      priority: 0,
      attempts: 0,
      maxAttempts: 5,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      completedAt: null,
      recipient: null,
    });
    expect(job.runAt).toBeInstanceOf(Date);
  });

  it("is wiped by the global test setup", async () => {
    expect(await prisma.job.count()).toBe(0);
  });
});
