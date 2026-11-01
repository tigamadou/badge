import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/subscription-access", () => ({
  loadOrgAccess: vi.fn(async (orgId: string) => ({ orgId, marker: "mock" })),
}));

import { getOrgAccess } from "../org-access";
import { loadOrgAccess } from "@/lib/subscription-access";

describe("getOrgAccess", () => {
  it("renvoie le résultat de loadOrgAccess", async () => {
    const res = await getOrgAccess("o1");
    expect(loadOrgAccess).toHaveBeenCalledWith("o1");
    expect(res).toEqual(await loadOrgAccess("o1"));
  });
});
