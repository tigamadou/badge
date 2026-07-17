import { describe, it, expect, beforeEach, vi } from "vitest";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/files/[...path]/route";
import { uploadFile, accountProfileKey } from "@/lib/storage";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function ctx(key: string) {
  return { params: Promise.resolve({ path: key.split("/") }) };
}
const req = () => new Request("http://test/api/files") as unknown as import("next/server").NextRequest;

describe("GET /api/files — controle d'acces aux documents", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
  });

  it("sert une photo publique sans session", async () => {
    const key = "events/pub-evt/photos/x.jpg";
    await uploadFile(key, Buffer.from("img"), "image/jpeg");
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(req(), ctx(key));
    expect(res.status).toBe(200);
  });

  it("refuse (403) un document de profil sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(req(), ctx("profile/u1/documents/d.pdf"));
    expect(res.status).toBe(403);
  });

  it("autorise le proprietaire (200) et refuse un autre user (403)", async () => {
    const owner = await prisma.user.create({ data: { email: "own@x", password: "x", name: "Own" } });
    const other = await prisma.user.create({ data: { email: "oth@x", password: "x", name: "Oth" } });
    const key = accountProfileKey(owner.id, "document", "d.pdf");
    await uploadFile(key, Buffer.from("pdf"), "application/pdf");

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: owner.id } } as never);
    expect((await GET(req(), ctx(key))).status).toBe(200);

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: other.id } } as never);
    expect((await GET(req(), ctx(key))).status).toBe(403);
  });
});
