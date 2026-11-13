import { describe, expect, it } from "vitest";
import type { Permission } from "@/lib/permissions/catalog";
import { RESERVED_PERMISSIONS } from "@/lib/permissions/catalog";
import {
  defaultRoleId,
  editablePermissions,
  effectiveSet,
  grantablePermissions,
  groupedPermissions,
  permissionsBySpace,
  overridesToRows,
  readOrThrow,
  roleErrorMessage,
  setOverrideState,
  stateOf,
  toggleOverride,
  togglePermission,
} from "../logic";
import { ActionError } from "@/lib/toast";

describe("editablePermissions", () => {
  it("ne propose jamais une permission réservée et respecte les niveaux", () => {
    const all = editablePermissions(["PLATFORM", "ORG", "EVENT", "PARTICIPANT"]);
    for (const reserved of RESERVED_PERMISSIONS) expect(all).not.toContain(reserved);
    expect(all).not.toContain("platform.roles.manage");
    expect(editablePermissions(["EVENT"]).every((k) => k.startsWith("event.") || k.startsWith("scan.") || k.length > 0)).toBe(true);
    expect(editablePermissions(["EVENT"])).not.toContain("org.update");
    expect(editablePermissions(["PARTICIPANT"])).toContain("registration.self.create");
  });

  it("groupe par domaine avec libellé", () => {
    const groups = groupedPermissions(["ORG"]);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.every((g) => g.label.length > 0 && g.permissions.length > 0)).toBe(true);
  });
});

describe("togglePermission", () => {
  const sel = new Set<Permission>(["org.read"]);
  it("ajoute puis retire une permission", () => {
    const added = togglePermission(sel, "org.update", undefined);
    expect([...added].sort()).toEqual(["org.read", "org.update"]);
    expect([...togglePermission(added, "org.update", undefined)]).toEqual(["org.read"]);
    expect([...sel]).toEqual(["org.read"]);
  });

  it("une case désactivée ne change pas la sélection", () => {
    const disabled = new Map<Permission, string>([["org.update", "non détenue"]]);
    expect([...togglePermission(sel, "org.update", disabled)]).toEqual(["org.read"]);
    expect([...togglePermission(sel, "org.read", disabled)]).toEqual([]);
  });
});

describe("ajustements", () => {
  const inherited = new Set<Permission>(["org.read", "org.update"]);

  it("stateOf et setOverrideState", () => {
    let o = new Map<Permission, "GRANT" | "REVOKE">();
    expect(stateOf(o, "org.read")).toBe("inherited");
    o = setOverrideState(o, "org.read", "revoked");
    expect(stateOf(o, "org.read")).toBe("revoked");
    o = setOverrideState(o, "org.events.create", "granted");
    expect(stateOf(o, "org.events.create")).toBe("granted");
    o = setOverrideState(o, "org.read", "inherited");
    expect(o.has("org.read")).toBe(false);
  });

  it("une permission héritée passée à « retiré » quitte l'effectif ; « ajouté » l'y met", () => {
    const revoked = setOverrideState(new Map(), "org.update", "revoked");
    expect(effectiveSet(inherited, revoked).has("org.update")).toBe(false);
    const granted = setOverrideState(new Map(), "org.events.create", "granted");
    expect(effectiveSet(inherited, granted).has("org.events.create")).toBe(true);
    const both = new Map<Permission, "GRANT" | "REVOKE">([["org.update", "GRANT"], ["org.update", "REVOKE"]]);
    expect(effectiveSet(inherited, both).has("org.update")).toBe(false);
  });

  it("overridesToRows suit l'ordre du catalogue", () => {
    const o = new Map<Permission, "GRANT" | "REVOKE">([["org.update", "REVOKE"], ["org.read", "GRANT"]]);
    expect(overridesToRows(o)).toEqual([
      { permission: "org.read", effect: "GRANT" },
      { permission: "org.update", effect: "REVOKE" },
    ]);
  });
});

describe("erreurs d'API", () => {
  it("roleErrorMessage traduit les codes connus et retombe sur un repli", () => {
    expect(roleErrorMessage("ROLE_NAME_TAKEN")).toContain("déjà utilisé");
    expect(roleErrorMessage("INCONNU")).toContain("Une erreur");
    expect(roleErrorMessage(undefined, "Repli")).toBe("Repli");
  });

  it("readOrThrow renvoie le JSON d'un succès et lève une ActionError française sinon", async () => {
    expect(await readOrThrow(new Response(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
    expect(await readOrThrow(new Response("pas du json"))).toEqual({});
    const err = (await readOrThrow(new Response(JSON.stringify({ error: "ROLE_IN_USE" }), { status: 409 })).catch((e: Error) => e)) as Error;
    expect(err).toBeInstanceOf(ActionError);
    expect(err.message).toContain("attribué");
    const bad = (await readOrThrow(new Response("x", { status: 500 })).catch((e: Error) => e)) as Error;
    expect(bad.message).toContain("Une erreur");
  });
});

describe("grantablePermissions", () => {
  it("ajoute les droits participant à ce que l'acteur détient", () => {
    const result = grantablePermissions(["org.read"]);
    expect(result).toContain("org.read");
    expect(result).toContain("registration.self.create");
    expect(result).not.toContain("org.update");
  });
});

describe("defaultRoleId", () => {
  const role = (id: string, systemKey: string | null, assignable: boolean) =>
    ({ id, name: id, systemKey, scope: "ORG", description: null, assignable }) as const;

  it("préfère le rôle système demandé s'il est attribuable, sinon le premier attribuable, sinon vide", () => {
    expect(defaultRoleId([role("a", "AGENT", true), role("o", "OWNER", true)], "OWNER")).toBe("o");
    expect(defaultRoleId([role("a", "AGENT", true), role("o", "OWNER", false)], "OWNER")).toBe("a");
    expect(defaultRoleId([role("o", "OWNER", false)], "OWNER")).toBe("");
    expect(defaultRoleId([], "OWNER")).toBe("");
  });
});

describe("permissionsBySpace", () => {
  it("sépare les espaces dans l'ordre des niveaux, sans mélanger les portées d'un même domaine", () => {
    const spaces = permissionsBySpace(["PLATFORM", "ORG", "EVENT"]);
    expect(spaces.map((s) => s.scope)).toEqual(["PLATFORM", "ORG", "EVENT"]);
    const keysOf = (i: number) => spaces[i].groups.flatMap((g) => g.permissions.map((d) => d.key));
    expect(keysOf(0)).toContain("organizations.members.manage");
    expect(keysOf(0)).not.toContain("org.members.manage");
    expect(keysOf(1)).toContain("org.members.manage");
    expect([...keysOf(0), ...keysOf(1), ...keysOf(2)].sort()).toEqual([...editablePermissions(["PLATFORM", "ORG", "EVENT"])].sort());
  });

  it("omet un espace sans permission éditable", () => {
    expect(permissionsBySpace(["EVENT"]).map((s) => s.label)).toEqual(["Espace évènement"]);
  });
});

describe("toggleOverride", () => {
  const inherited = new Set<Permission>(["org.read"]);

  it("désactiver une permission héritée pose un retrait ; la réactiver le supprime", () => {
    const revoked = toggleOverride(inherited, new Map(), "org.read");
    expect(revoked.get("org.read")).toBe("REVOKE");
    expect(toggleOverride(inherited, revoked, "org.read").has("org.read")).toBe(false);
  });

  it("activer une permission non héritée pose un ajout ; la désactiver le supprime", () => {
    const granted = toggleOverride(inherited, new Map(), "org.update");
    expect(granted.get("org.update")).toBe("GRANT");
    expect(toggleOverride(inherited, granted, "org.update").has("org.update")).toBe(false);
  });
});
