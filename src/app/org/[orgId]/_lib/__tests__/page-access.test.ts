import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOrg, makeOrgMember, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { getServerSession } from "next-auth";
import { requireOrgPagePermission } from "../page-access";

seedFactories(2203);

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue((user ? { user: { ...user, isStaff: false } } : null) as never);
}

describe("requireOrgPagePermission", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("sans session : connexion avec callbackUrl", async () => {
    as(null);
    await expect(requireOrgPagePermission("o1", "org.read", "/org/o1/settings")).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Forg%2Fo1%2Fsettings",
    );
  });

  it("session sans compte en base : connexion", async () => {
    as({ id: "inconnu", email: "x@x.test", name: "X" });
    await expect(requireOrgPagePermission("o1", "org.read", "/org/o1")).rejects.toThrow("REDIRECT:/login");
  });

  it("permission détenue : renvoie le contexte et les permissions", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    as(owner);
    const res = await requireOrgPagePermission(org.id, "org.update", `/org/${org.id}/settings`);
    expect(res.permissions.has("org.update")).toBe(true);
    expect(res.ctx.user.id).toBe(owner.id);
  });

  it("permission manquante : retour au tableau de bord de l'organisation", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "AUDITOR"));
    await expect(requireOrgPagePermission(org.id, "org.update", "/x")).rejects.toThrow(`REDIRECT:/org/${org.id}`);
  });

  it("liste : la seconde permission suffit", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "AUDITOR"));
    const res = await requireOrgPagePermission(org.id, ["org.update", "org.activity.read"], "/x");
    expect(res.permissions.has("org.activity.read")).toBe(true);
  });

  it("membre d'une autre organisation : refusé", async () => {
    const org = await makeOrg();
    const other = await makeOrg();
    as(await makeOrgMember(other.id, "OWNER"));
    await expect(requireOrgPagePermission(org.id, "org.read", "/x")).rejects.toThrow(`REDIRECT:/org/${org.id}`);
    as(await makeUser());
    await expect(requireOrgPagePermission(org.id, "org.read", "/x")).rejects.toThrow(`REDIRECT:/org/${org.id}`);
  });
});
