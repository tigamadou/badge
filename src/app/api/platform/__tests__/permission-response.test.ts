import { describe, it, expect, vi } from "vitest";
import { makeEvent, makeOrg, makeOrgMember, makeStaff } from "@/test/factories";
import { eventTargetOf } from "@/lib/permissions";
import { permissionDenied } from "../permission-response";

describe("permissionDenied", () => {
  it("renvoie null pour un SUPER_ADMIN", async () => {
    const u = await makeStaff("SUPER_ADMIN");
    expect(await permissionDenied(u.id, "organizations.delete")).toBeNull();
  });

  it("renvoie 403 PERMISSION_DENIED pour l'Observateur sur organizations.update", async () => {
    const u = await makeStaff("STAFF_OBSERVER");
    const res = await permissionDenied(u.id, "organizations.update");
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "PERMISSION_DENIED" });
  });

  it("accepte une liste (au moins une permission)", async () => {
    const u = await makeStaff("STAFF_OBSERVER");
    expect(await permissionDenied(u.id, ["organizations.update", "organizations.read"])).toBeNull();
  });

  it("honore la cible évènement", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const printer = await makeStaff("STAFF_PRINTER");
    const observer = await makeStaff("STAFF_OBSERVER");
    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    expect(await permissionDenied(printer.id, "print.onsite.operate", target)).toBeNull();
    expect((await permissionDenied(observer.id, "print.onsite.operate", target))?.status).toBe(403);
  });

  it("renvoie 401 quand le compte n'existe pas", async () => {
    const res = await permissionDenied("inconnu", "platform.access");
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "NOT_AUTHENTICATED" });
  });

  it("relance les erreurs inattendues", async () => {
    const guards = await import("@/lib/auth-guards");
    const spy = vi.spyOn(guards, "requirePermission").mockRejectedValue(new Error("boom"));
    await expect(permissionDenied("x", "platform.access")).rejects.toThrow("boom");
    spy.mockRestore();
  });

  it("un membre d'organisation sans rôle plateforme est refusé sur une clé plateforme", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    expect((await permissionDenied(owner.id, "platform.access"))?.status).toBe(403);
  });
});
