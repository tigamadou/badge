import { describe, it, expect } from "vitest";
import { resolveBadgeTemplateId } from "@/lib/settings";

describe("resolveBadgeTemplateId", () => {
  const platform = { badgeTemplateId: "default-v1" } as const;

  it("renvoie Event.badgeTemplateId quand defini", () => {
    expect(
      resolveBadgeTemplateId(
        { badgeTemplateId: "evt-template" },
        { badgeTemplateId: "org-template" },
        platform,
      ),
    ).toBe("evt-template");
  });

  it("fallback Organization quand Event.badgeTemplateId est null", () => {
    expect(
      resolveBadgeTemplateId(
        { badgeTemplateId: null },
        { badgeTemplateId: "org-template" },
        platform,
      ),
    ).toBe("org-template");
  });

  it("fallback Platform quand Event et Organization sont null", () => {
    expect(
      resolveBadgeTemplateId(
        { badgeTemplateId: null },
        { badgeTemplateId: null },
        platform,
      ),
    ).toBe("default-v1");
  });

  it("supporte une Organization null (cas event hors-tenant)", () => {
    expect(
      resolveBadgeTemplateId({ badgeTemplateId: null }, null, platform),
    ).toBe("default-v1");
  });

  it("respecte une valeur platform alternative", () => {
    expect(
      resolveBadgeTemplateId(null, null, { badgeTemplateId: "platform-alt" }),
    ).toBe("platform-alt");
  });
});
