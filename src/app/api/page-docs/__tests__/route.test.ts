import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrg, makeOrgMember, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/content/page-docs/index.generated", async () => ({
  PAGE_DOC_INDEX: (await import("@/lib/page-docs/__tests__/fixtures")).FIXTURE_INDEX,
}));
vi.mock("@/content/page-docs/manifest.generated", async () => ({
  PAGE_DOCS: (await import("@/lib/page-docs/__tests__/fixtures")).FIXTURE_DOCS,
}));
import { getServerSession } from "next-auth";
import { GET } from "../route";

seedFactories(4103);

const call = (path?: string) =>
  GET(new NextRequest(`http://localhost/api/page-docs${path === undefined ? "" : `?path=${encodeURIComponent(path)}`}`));

function login(u: { id: string; email: string; name: string }) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { ...u, isStaff: false } } as never);
}

describe("GET /api/page-docs", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const res = await call("/account");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "NOT_AUTHENTICATED" });
  });

  it("401 pour un compte archivé ou supprimé, 403 pour un compte bloqué", async () => {
    const archived = await makeUser({ archived: true });
    login(archived);
    expect((await call("/account")).status).toBe(401);
    const blocked = await makeUser({ blocked: true });
    login(blocked);
    const res = await call("/account");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "ACCOUNT_BLOCKED" });
    login({ id: "inexistant", email: "x@x.test", name: "X" });
    expect((await call("/account")).status).toBe(401);
  });

  it("400 sans path ou avec un path trop long", async () => {
    const user = await makeUser();
    login(user);
    expect((await call()).status).toBe(400);
    expect((await call("")).status).toBe(400);
    const res = await call("/org/" + "a".repeat(300));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "VALIDATION", error: "Paramètre path invalide." });
  });

  it("404 sans révéler la structure : page sans doc, chemin hors espaces, aucun droit", async () => {
    const org = await makeOrg();
    const stranger = await makeUser();
    login(stranger);
    for (const path of ["/org/x/inconnue", "/login", "/e/slug", `/org/${org.id}`]) {
      const res = await call(path);
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: "NOT_FOUND" });
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("200 avec le html filtré : le contenu d'un bloc non détenu n'apparaît nulle part dans la réponse", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");

    login(owner);
    const ownerRes = await call(`/org/${org.id}?tab=1`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.headers.get("Cache-Control")).toBe("private, no-store");
    const ownerBody = await ownerRes.json();
    expect(ownerBody.html).toContain("Secret des propriétaires.");
    expect(ownerBody).toMatchObject({ id: "org/index", docsHref: `/org/${org.id}/docs`, updatedAt: "2026-11-20" });

    login(auditor);
    const auditorRes = await call(`/org/${org.id}`);
    expect(auditorRes.status).toBe(200);
    const raw = JSON.stringify(await auditorRes.json());
    expect(raw).toContain("votre organisation");
    expect(raw).not.toContain("Secret des propriétaires.");
    expect(raw).not.toContain("Modifier");
  });

  it("relance une erreur inattendue", async () => {
    const user = await makeUser();
    login(user);
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db boom"));
    await expect(call("/account")).rejects.toThrow("db boom");
    spy.mockRestore();
  });

  it("n'appelle aucune API externe", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = await makeUser();
    login(user);
    expect((await call("/account")).status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
