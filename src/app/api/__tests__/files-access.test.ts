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

  it("sert une bannière d'évènement sans session", async () => {
    const key = "orgs/pub-org/images/cover.png";
    await uploadFile(key, Buffer.from("img"), "image/png");
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(req(), ctx(key));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
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

  it("retourne 404 quand la cle n'existe pas dans le storage (photo publique absente)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(req(), ctx("events/no-such-event/photos/missing.jpg"));
    expect(res.status).toBe(404);
  });

  it("refuse (403) quand la session pointe vers un user absent de la base (ctx null)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "ghost-user-id" } } as never);
    const res = await GET(req(), ctx("profile/whoever/documents/d.pdf"));
    expect(res.status).toBe(403);
  });

  it("autorise le staff (200) a lire un document prive appartenant a un autre user", async () => {
    const owner = await prisma.user.create({ data: { email: "own2@x", password: "x", name: "Own2" } });
    const staff = await prisma.user.create({
      data: { email: "staff@x", password: "x", name: "Staff", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const key = accountProfileKey(owner.id, "document", "d2.pdf");
    await uploadFile(key, Buffer.from("pdf"), "application/pdf");

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: staff.id } } as never);
    expect((await GET(req(), ctx(key))).status).toBe(200);
  });

  it("refuse (403) l'acces a un document d'inscription quand l'event n'existe pas", async () => {
    const user = await prisma.user.create({ data: { email: "u1@x", password: "x", name: "U1" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
    const res = await GET(req(), ctx("events/no-such-event/idDocuments/d.pdf"));
    expect(res.status).toBe(403);
  });

  it("autorise (200) un membre ADMIN de l'event a lire un document d'inscription", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-files-admin" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ev-files-admin", location: "L", date: new Date() },
    });
    const admin = await prisma.user.create({ data: { email: "admin@x", password: "x", name: "Admin" } });
    await prisma.eventMembership.create({ data: { userId: admin.id, eventId: event.id, role: "ADMIN" } });

    const key = `events/${event.id}/idDocuments/d.pdf`;
    await uploadFile(key, Buffer.from("pdf"), "application/pdf");

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: admin.id } } as never);
    expect((await GET(req(), ctx(key))).status).toBe(200);
  });

  it("refuse (403) un membre VIEWER de l'event (pas de droit event.read.detailed)", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-files-viewer" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ev-files-viewer", location: "L", date: new Date() },
    });
    const viewer = await prisma.user.create({ data: { email: "viewer@x", password: "x", name: "Viewer" } });
    await prisma.eventMembership.create({ data: { userId: viewer.id, eventId: event.id, role: "VIEWER" } });

    const key = `events/${event.id}/idDocuments/d.pdf`;
    await uploadFile(key, Buffer.from("pdf"), "application/pdf");

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: viewer.id } } as never);
    expect((await GET(req(), ctx(key))).status).toBe(403);
  });

  it("des segments de type traversal ne contournent pas l'ACL (403 pour un autre user)", async () => {
    const owner = await prisma.user.create({ data: { email: "own3@x", password: "x", name: "Own3" } });
    const other = await prisma.user.create({ data: { email: "oth3@x", password: "x", name: "Oth3" } });
    // Le path est un tableau de segments (ctx.path) : ".." reste un segment opaque
    // pour l'API route (pas d'acces filesystem direct, cle S3 seulement), mais on
    // verifie que la regex de classification n'est pas trompee par ce segment.
    const key = accountProfileKey(owner.id, "document", "secret.pdf");
    await uploadFile(key, Buffer.from("pdf"), "application/pdf");
    const traversalPath = [...key.split("/").slice(0, -1), "..", "secret.pdf"].join("/");

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: other.id } } as never);
    const res = await GET(req(), ctx(traversalPath));
    expect(res.status).toBe(403);
  });
});
