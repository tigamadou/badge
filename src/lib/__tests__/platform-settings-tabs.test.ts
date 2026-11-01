import { describe, it, expect } from "vitest";
import { resolveSettingsTab, visibleSettingsTabs } from "@/lib/platform-settings-tabs";

describe("visibleSettingsTabs", () => {
  it("masque les onglets Badge et Impression sur place sous STAFF_ADMIN", () => {
    expect(visibleSettingsTabs(false).map((t) => t.value)).toEqual([
      "email",
      "security",
      "subscriptions",
      "reasons",
    ]);
    expect(visibleSettingsTabs(true).map((t) => t.value)).toContain("badge");
    const admin = visibleSettingsTabs(true);
    expect(admin[admin.length - 1]).toEqual({
      value: "onsite-print",
      label: "Impression sur place",
      adminOnly: true,
    });
  });
});

describe("resolveSettingsTab", () => {
  it("retient un onglet connu et visible", () => {
    expect(resolveSettingsTab("reasons", false)).toBe("reasons");
    expect(resolveSettingsTab("badge", true)).toBe("badge");
  });

  it("retombe sur le premier onglet si absent, inconnu ou non autorisé", () => {
    expect(resolveSettingsTab(undefined, true)).toBe("email");
    expect(resolveSettingsTab("foo", true)).toBe("email");
    expect(resolveSettingsTab("badge", false)).toBe("email");
    expect(resolveSettingsTab("onsite-print", false)).toBe("email");
    expect(resolveSettingsTab("onsite-print", true)).toBe("onsite-print");
  });
});
