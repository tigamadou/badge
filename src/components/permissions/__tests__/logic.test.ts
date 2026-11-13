import { describe, expect, it } from "vitest";
import type { Permission } from "@/lib/permissions/catalog";
import { RESERVED_PERMISSIONS } from "@/lib/permissions/catalog";
import {
  editablePermissions,
  effectiveSet,
  groupedPermissions,
  overridesToRows,
  readOrThrow,
  roleErrorMessage,
  setOverrideState,
  stateOf,
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
