import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { getEventTarget } from "@/lib/event-org";
import { makeEvent, makeOrg } from "@/test/factories";

describe("getEventTarget", () => {
  it("renvoie la cible evenement", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    await expect(getEventTarget(event.id)).resolves.toEqual({ kind: "event", eventId: event.id, orgId: org.id });
  });

  it("appelle notFound() si l'evenement est absent", async () => {
    await expect(getEventTarget("missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
