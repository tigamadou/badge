import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStaff, makeUser } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import { getServerSession } from "next-auth";
import { requirePlatformPage } from "../page-guard";

function session(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id } } as never);
}

describe("requirePlatformPage", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("redirige vers la connexion sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    await expect(requirePlatformPage("organizations.read", "/platform/organizations")).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Fplatform%2Forganizations",
    );
  });

  it("utilise /platform comme retour par défaut", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    await expect(requirePlatformPage("organizations.read")).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Fplatform",
    );
  });

  it("redirige un Imprimeur vers /platform quand la permission manque", async () => {
    const u = await makeStaff("STAFF_PRINTER");
    session(u.id);
    await expect(requirePlatformPage("organizations.read")).rejects.toThrow("REDIRECT:/platform");
  });

  it("redirige un compte non staff vers /platform", async () => {
    const u = await makeUser();
    session(u.id);
    await expect(requirePlatformPage("platform.access")).rejects.toThrow("REDIRECT:/platform");
  });

  it("renvoie les permissions effectives d'un STAFF_ADMIN", async () => {
    const u = await makeStaff("STAFF_ADMIN");
    session(u.id);
    const res = await requirePlatformPage("organizations.read");
    expect(res.userId).toBe(u.id);
    expect(res.permissions.has("organizations.create")).toBe(true);
    expect(res.permissions.has("organizations.delete")).toBe(false);
  });
});
