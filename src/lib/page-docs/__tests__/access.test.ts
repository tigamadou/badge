import { describe, expect, it } from "vitest";
import { makeEvent, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";
import { blockDecider, permissionsForRoute, resolveDocTarget } from "../access";

seedFactories(4101);

describe("resolveDocTarget", () => {
  it("plateforme et participant : cibles sans identifiant", async () => {
    expect(await resolveDocTarget("/platform/organizations/[orgId]", {})).toEqual({ kind: "platform" });
    expect(await resolveDocTarget("/account", {})).toEqual({ kind: "participant" });
  });

  it("organisation : exige orgId", async () => {
    expect(await resolveDocTarget("/org/[orgId]/events", { orgId: "o1" })).toEqual({ kind: "org", orgId: "o1" });
    expect(await resolveDocTarget("/org/[orgId]/events", {})).toBeNull();
  });

  it("évènement : lit orgId en base, null si l'évènement est inconnu ou absent", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    expect(await resolveDocTarget("/event/[eventId]", { eventId: event.id })).toEqual({
      kind: "event",
      eventId: event.id,
      orgId: org.id,
    });
    expect(await resolveDocTarget("/event/[eventId]", { eventId: "inconnu" })).toBeNull();
    expect(await resolveDocTarget("/event/[eventId]", {})).toBeNull();
  });
});

describe("permissionsForRoute", () => {
  it("renvoie les permissions effectives, vides si la cible est introuvable ou le compte archivé", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const archived = await makeOrgMember(org.id, "OWNER", { archived: true });
    expect((await permissionsForRoute(owner.id, "/org/[orgId]", { orgId: org.id })).has("org.update")).toBe(true);
    expect((await permissionsForRoute(owner.id, "/event/[eventId]", { eventId: "inconnu" })).size).toBe(0);
    expect((await permissionsForRoute(archived.id, "/org/[orgId]", { orgId: org.id })).size).toBe(0);
    const staff = await makeStaff("STAFF_PRINTER");
    expect((await permissionsForRoute(staff.id, "/platform", {})).has("platform.access")).toBe(true);
    const user = await makeUser();
    expect((await permissionsForRoute(user.id, "/account", {})).size).toBeGreaterThan(0);
  });
});

describe("blockDecider", () => {
  const perms = new Set(["org.update"]) as never;
  it("true si détenue, false sinon, undefined hors portée, false pour une clé inconnue", () => {
    const decide = blockDecider(perms, "ORG");
    expect(decide("org.update")).toBe(true);
    expect(decide("org.read")).toBe(false);
    expect(decide("platform.access")).toBeUndefined();
    expect(decide("nope.cle")).toBe(false);
  });
});
