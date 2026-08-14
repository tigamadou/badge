import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock complet de prisma : ce fichier est un test unitaire pur (pas de BDD).
// Le mock couvre aussi les modeles effaces par le setup global (src/test-setup.ts),
// dont le beforeEach appelle deleteMany() sur chacun.
vi.mock("@/lib/prisma", () => {
  const models = [
    "activityLog",
    "subscription",
    "plan",
    "registration",
    "blockedEmail",
    "blockedDocument",
    "category",
    "eventSettings",
    "eventMembership",
    "event",
    "categoryTemplate",
    "orgMembership",
    "organization",
    "user",
  ];
  const client: Record<string, unknown> = {};
  for (const m of models) {
    client[m] = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
  }
  (client.event as { findUnique: unknown }).findUnique = vi.fn();
  return { prisma: client };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getEventOrgId } from "@/lib/event-org";

describe("getEventOrgId", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset();
    vi.mocked(notFound).mockClear();
  });

  it("returns the orgId when the event exists", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ orgId: "org-123" } as never);

    await expect(getEventOrgId("evt-1")).resolves.toBe("org-123");
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      select: { orgId: true },
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound() when the event is absent", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null as never);

    await expect(getEventOrgId("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
