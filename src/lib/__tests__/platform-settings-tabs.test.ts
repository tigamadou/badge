import { describe, it, expect } from "vitest";
import {
  hasAnySettingsTab,
  resolveSettingsTab,
  visibleSettingsTabs,
} from "@/lib/platform-settings-tabs";
import { systemRolePermissions } from "@/lib/permissions";

const SA = systemRolePermissions("SUPER_ADMIN");
const AD = systemRolePermissions("STAFF_ADMIN");
const SU = systemRolePermissions("STAFF_SUPPORT");
const OB = systemRolePermissions("STAFF_OBSERVER");
const PR = systemRolePermissions("STAFF_PRINTER");

describe("visibleSettingsTabs", () => {
  it("masque Badge et Impression sur place à l'Observateur et au Support", () => {
    for (const perms of [OB, SU]) {
      expect(visibleSettingsTabs(perms).map((t) => t.value)).toEqual(["email", "security", "subscriptions", "reasons"]);
    }
  });

  it("montre tous les onglets au Staff admin et au Super admin, Impression sur place en dernier", () => {
    for (const perms of [AD, SA]) {
      const tabs = visibleSettingsTabs(perms);
      expect(tabs.map((t) => t.value)).toContain("badge");
      expect(tabs[tabs.length - 1].value).toBe("onsite-print");
    }
  });

  it("ne montre rien à l'Imprimeur", () => {
    expect(visibleSettingsTabs(PR)).toEqual([]);
  });
});

describe("hasAnySettingsTab", () => {
  it("est faux pour l'Imprimeur, vrai pour l'Observateur", () => {
    expect(hasAnySettingsTab(PR)).toBe(false);
    expect(hasAnySettingsTab(OB)).toBe(true);
  });
});

describe("resolveSettingsTab", () => {
  it("retient un onglet connu et visible", () => {
    expect(resolveSettingsTab("reasons", OB)).toBe("reasons");
    expect(resolveSettingsTab("badge", AD)).toBe("badge");
  });

  it("retombe sur le premier onglet si absent, inconnu ou non autorisé", () => {
    expect(resolveSettingsTab(undefined, AD)).toBe("email");
    expect(resolveSettingsTab("foo", AD)).toBe("email");
    expect(resolveSettingsTab("badge", OB)).toBe("email");
    expect(resolveSettingsTab("onsite-print", OB)).toBe("email");
    expect(resolveSettingsTab("onsite-print", AD)).toBe("onsite-print");
  });

  it("renvoie null sans aucun onglet visible", () => {
    expect(resolveSettingsTab("email", PR)).toBeNull();
  });
});
