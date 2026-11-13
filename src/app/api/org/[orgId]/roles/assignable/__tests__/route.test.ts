import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeCustomRole, makeEvent, makeOrg, makeOrgMember, makeOverride, makeStaff, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET } from "../route";

beforeEach(() => {
  seedFactories(33);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const call = (orgId: string, q: string) =>
  GET(new NextRequest(`http://localhost/api/org/${orgId}/roles/assignable${q}`), { params: Promise.resolve({ orgId }) });

type Row = { name: string; assignable: boolean; reason?: string };

describe("GET /api/org/[orgId]/roles/assignable", () => {
  it("401 sans session ; 403 hors organisation", async () => {
    const org = await makeOrg();
    as(null);
    expect((await call(org.id, "?scope=ORG")).status).toBe(401);
    as(await makeOrgMember((await makeOrg()).id, "OWNER"));
    expect((await call(org.id, "?scope=ORG")).status).toBe(403);
  });

  it("OWNER : tous les rôles système et ceux de son organisation, jamais ceux d'une autre", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    await makeCustomRole({ scope: "ORG", orgId: a.id, name: "De A", permissions: ["org.read"] });
    await makeCustomRole({ scope: "ORG", orgId: b.id, name: "De B", permissions: ["org.read"] });
    const { roles } = (await (await call(a.id, "?scope=ORG")).json()) as { roles: Row[] };
    expect(roles.map((r) => r.name)).toEqual(["Propriétaire", "Gestionnaire", "Auditeur", "Agent", "De A"]);
    expect(roles.every((r) => r.assignable)).toBe(true);
  });

  it("MANAGER lecteur : OWNER non assignable avec raison ; OWNER réduit : rôle personnalisé grisé", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "MANAGER"));
    const mgr = (await (await call(org.id, "?scope=ORG")).json()) as { roles: Row[] };
    expect(mgr.roles.find((r) => r.name === "Propriétaire")).toMatchObject({ assignable: false });
    expect(mgr.roles.find((r) => r.name === "Propriétaire")!.reason).toMatch(/« .+ »/);
    expect(mgr.roles.find((r) => r.name === "Auditeur")!.assignable).toBe(true);

    const owner = await makeOrgMember(org.id, "OWNER");
    await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Payeur", permissions: ["billing.subscription.pay"] });
    await makeOverride({ userId: owner.id, orgId: org.id, permission: "billing.subscription.pay", effect: "REVOKE" });
    as(owner);
    const reduced = (await (await call(org.id, "?scope=ORG")).json()) as { roles: Row[] };
    expect(reduced.roles.find((r) => r.name === "Payeur")!.assignable).toBe(false);
  });

  it("scope=EVENT, avec ou sans évènement ; évènement d'une autre organisation : 404", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    const event = await makeEvent(a.id);
    const foreignEvent = await makeEvent(b.id);
    as(await makeStaff("SUPER_ADMIN"));
    const plain = (await (await call(a.id, "?scope=EVENT")).json()) as { roles: Row[] };
    expect(plain.roles.map((r) => r.name)).toHaveLength(4);
    const withEvent = (await (await call(a.id, `?scope=EVENT&eventId=${event.id}`)).json()) as { roles: Row[] };
    expect(withEvent.roles.every((r) => r.assignable)).toBe(true);
    expect((await call(a.id, `?scope=EVENT&eventId=${foreignEvent.id}`)).status).toBe(404);
  });

  it("scope invalide : 400", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await call(org.id, "?scope=PLATFORM")).status).toBe(400);
    expect((await call(org.id, "")).status).toBe(400);
  });
});
